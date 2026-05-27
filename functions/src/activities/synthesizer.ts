import * as df from 'durable-functions';
import type { InvocationContext } from '@azure/functions';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, CLAUDE_MODEL } from '../lib/anthropic';
import { validateSynthesis } from '../lib/synthesizerValidator';
import {
  SYNTHESIZER_SYSTEM_PROMPT,
  GENERATE_SYNTHESIS_TOOL,
} from '../prompts/synthesizer';
import {
  FhirBundleSchema,
  DifferentialOutputSchema,
  DevilsAdvocateOutputSchema,
  type FhirBundle,
  type DifferentialOutput,
  type DevilsAdvocateOutput,
  type SynthesisOutput,
} from '../lib/schemas';
import { getStore, type TraceEntry } from '../lib/cosmos';

const MAX_RETRIES = 3;

export type SynthesizerInput = {
  caseId: string;
  historianOutput: {
    bundle: FhirBundle;
    attempts?: number;
    validationErrors?: string[][];
  };
  differentialOutput: DifferentialOutput;
  devilsAdvocateOutput: DevilsAdvocateOutput;
  // TODO: Evidence is a pass-through stub until Azure AI Search wiring lands.
  // When Evidence becomes real, weave its content into buildUserMessage.
  evidenceOutput: unknown;
};

export type SynthesizerActivityResult = {
  synthesis: SynthesisOutput;
  attempts: number;
  validationErrors: string[][];
  warnings: string[];
};

df.app.activity('synthesizer', {
  handler: async (
    raw: unknown,
    context: InvocationContext
  ): Promise<SynthesizerActivityResult> => {
    const startedAt = new Date().toISOString();
    const input = raw as SynthesizerInput;
    const store = await getStore();

    const trace: TraceEntry = {
      caseId: input.caseId,
      step: 5,
      agent: 'synthesizer',
      status: 'started',
      input: {
        historianOutput: input.historianOutput,
        differentialOutput: input.differentialOutput,
        devilsAdvocateOutput: input.devilsAdvocateOutput,
        evidenceOutput: input.evidenceOutput,
      },
      startedAt,
    };
    await store.writeTrace(trace);

    try {
      const bundle = FhirBundleSchema.parse(input.historianOutput.bundle);
      const differential = DifferentialOutputSchema.parse(input.differentialOutput);
      const devilsAdvocate = DevilsAdvocateOutputSchema.parse(input.devilsAdvocateOutput);
      const result = await runSynthesizer(bundle, differential, devilsAdvocate, context);

      await store.writeTrace({
        ...trace,
        status: 'completed',
        output: result,
        completedAt: new Date().toISOString(),
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.writeTrace({
        ...trace,
        status: 'failed',
        error: message,
        completedAt: new Date().toISOString(),
      });
      throw err;
    }
  },
});

async function runSynthesizer(
  bundle: FhirBundle,
  differential: DifferentialOutput,
  devilsAdvocate: DevilsAdvocateOutput,
  context: InvocationContext
): Promise<SynthesizerActivityResult> {
  const client = getAnthropicClient();
  const userMessage = buildUserMessage(bundle, differential, devilsAdvocate);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  const validationErrors: string[][] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    context.log(`[synthesizer] attempt ${attempt + 1}/${MAX_RETRIES + 1}`);

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: SYNTHESIZER_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ] as Anthropic.TextBlockParam[],
      tools: [GENERATE_SYNTHESIS_TOOL] as unknown as Anthropic.Tool[],
      messages,
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'generate_synthesis'
    );

    if (!toolUse) {
      const text = response.content.find((b) => b.type === 'text');
      const preview =
        text && 'text' in text ? text.text.slice(0, 200) : '(no text content)';
      const errMsg = `Synthesizer did not call generate_synthesis. Model said: ${preview}`;
      validationErrors.push([errMsg]);

      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `Synthesizer failed after ${MAX_RETRIES + 1} attempts: ${errMsg}`
        );
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content:
          'You must call the generate_synthesis tool with your final reasoning note. ' +
          'Do not respond with text — call the tool.',
      });
      continue;
    }

    const result = validateSynthesis(toolUse.input, devilsAdvocate);

    if (result.ok) {
      if (result.warnings.length > 0) {
        for (const w of result.warnings) context.log(`[synthesizer] warning: ${w}`);
      }
      return {
        synthesis: result.synthesis,
        attempts: attempt + 1,
        validationErrors,
        warnings: result.warnings,
      };
    }

    validationErrors.push(result.errors);

    if (attempt >= MAX_RETRIES) {
      throw new Error(
        `Synthesizer validation failed after ${MAX_RETRIES + 1} attempts. Final errors:\n` +
          result.errors.join('\n')
      );
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content:
            `Validation failed with these errors:\n${result.errors.join('\n')}\n\n` +
            'Call generate_synthesis again with a corrected payload that addresses every error above.',
          is_error: true,
        },
      ],
    });
  }

  throw new Error('Synthesizer loop exited unexpectedly');
}

function buildUserMessage(
  bundle: FhirBundle,
  differential: DifferentialOutput,
  devilsAdvocate: DevilsAdvocateOutput
): string {
  const lines: string[] = [];
  lines.push('# Clinical case (from FHIR bundle)', '');

  const patient = bundle.entry.find((e) => e.resource.resourceType === 'Patient')
    ?.resource as { resourceType: 'Patient'; gender?: string; birthDate?: string } | undefined;
  const conditions = bundle.entry
    .map((e) => e.resource)
    .filter((r): r is Extract<typeof r, { resourceType: 'Condition' }> =>
      r.resourceType === 'Condition'
    );
  const observations = bundle.entry
    .map((e) => e.resource)
    .filter((r): r is Extract<typeof r, { resourceType: 'Observation' }> =>
      r.resourceType === 'Observation'
    );
  const medications = bundle.entry
    .map((e) => e.resource)
    .filter((r): r is Extract<typeof r, { resourceType: 'MedicationStatement' }> =>
      r.resourceType === 'MedicationStatement'
    );

  const demo: string[] = [];
  if (patient?.gender) demo.push(patient.gender);
  if (patient?.birthDate) demo.push(`born ${patient.birthDate}`);
  lines.push(`**Patient:** ${demo.length ? demo.join(', ') : '(no demographics recorded)'}`);

  const chiefComplaint = observations.find((o) => o.code.text === 'Chief complaint');
  if (chiefComplaint) {
    lines.push(`**Chief complaint:** ${chiefComplaint.valueString ?? '(no value)'}`);
  }

  const vitalCodes = new Set([
    'Blood pressure',
    'Heart rate',
    'Body temperature',
    'Respiratory rate',
    'Oxygen saturation',
  ]);
  const vitals = observations.filter((o) => vitalCodes.has(o.code.text));
  if (vitals.length) {
    lines.push('', '**Vital signs:**');
    for (const v of vitals) lines.push(`- ${v.code.text}: ${formatObservationValue(v)}`);
  }

  if (conditions.length) {
    lines.push('', '**Conditions / past medical history:**');
    for (const c of conditions) {
      const status =
        c.clinicalStatus?.coding?.[0]?.code ?? c.clinicalStatus?.text ?? 'unspecified';
      lines.push(`- ${c.code.text} (${status})`);
    }
  }

  if (medications.length) {
    lines.push('', '**Current medications:**');
    for (const m of medications) {
      lines.push(`- ${m.medicationCodeableConcept.text} (${m.status})`);
    }
  }

  const otherObs = observations.filter(
    (o) => o.code.text !== 'Chief complaint' && !vitalCodes.has(o.code.text)
  );
  if (otherObs.length) {
    lines.push('', '**Other findings / exam:**');
    for (const o of otherObs) {
      lines.push(`- ${o.code.text}: ${formatObservationValue(o)}`);
    }
  }

  lines.push('', '---', '', '# Differential agent output', '');
  lines.push(`**Reasoning summary:** ${differential.reasoning_summary}`);
  if (differential.red_flags.length) {
    lines.push('', '**Red flags (from differential):**');
    for (const r of differential.red_flags) lines.push(`- ${r}`);
  } else {
    lines.push('', '**Red flags (from differential):** (none)');
  }

  lines.push('', '**Ranked diagnoses:**');
  for (let i = 0; i < differential.ranked_diagnoses.length; i++) {
    const d = differential.ranked_diagnoses[i];
    lines.push('');
    lines.push(
      `${i + 1}. **${d.diagnosis}**${d.icd10_code ? ` (${d.icd10_code})` : ''} — ` +
        `confidence ${d.confidence.toFixed(2)}`
    );
    lines.push(`   - Reasoning: ${d.reasoning}`);
    lines.push(
      `   - Supporting: ${d.supporting_findings.length ? d.supporting_findings.join('; ') : '(none listed)'}`
    );
    lines.push(
      `   - Refuting: ${d.refuting_findings.length ? d.refuting_findings.join('; ') : '(none listed)'}`
    );
  }

  lines.push('', '---', '', "# Devil's Advocate critique", '');
  lines.push(`**Overall assessment:** ${devilsAdvocate.overall_assessment}`);
  lines.push(`**Assessment reasoning:** ${devilsAdvocate.assessment_reasoning}`);
  if (devilsAdvocate.agreed_top_diagnosis) {
    lines.push(`**Agreed top diagnosis:** ${devilsAdvocate.agreed_top_diagnosis}`);
  }

  lines.push('', '**Critiques:**');
  for (let i = 0; i < devilsAdvocate.critiques.length; i++) {
    const c = devilsAdvocate.critiques[i];
    lines.push('');
    lines.push(
      `${i + 1}. [${c.severity.toUpperCase()}] type=\`${c.type}\` — target: ${c.target_diagnosis}`
    );
    lines.push(`   - Argument: ${c.argument}`);
    if (c.alternative_diagnosis) {
      lines.push(
        `   - Alternative: ${c.alternative_diagnosis}${c.alternative_icd10_code ? ` (${c.alternative_icd10_code})` : ''}`
      );
    }
    lines.push(
      `   - Evidence: ${c.evidence_from_bundle.length ? c.evidence_from_bundle.join('; ') : '(none listed)'}`
    );
  }

  lines.push('', '---', '', 'Produce your synthesis by calling generate_synthesis.');
  return lines.join('\n');
}

function formatObservationValue(o: {
  valueString?: string;
  valueQuantity?: { value: number; unit?: string };
  valueCodeableConcept?: { text: string };
}): string {
  if (o.valueString) return o.valueString;
  if (o.valueQuantity) {
    return o.valueQuantity.unit
      ? `${o.valueQuantity.value} ${o.valueQuantity.unit}`
      : String(o.valueQuantity.value);
  }
  if (o.valueCodeableConcept) return o.valueCodeableConcept.text;
  return '(no value)';
}
