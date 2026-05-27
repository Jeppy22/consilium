import * as df from 'durable-functions';
import type { InvocationContext } from '@azure/functions';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, CLAUDE_MODEL } from '../lib/anthropic';
import { validateDifferential } from '../lib/differentialValidator';
import {
  DIFFERENTIAL_SYSTEM_PROMPT,
  GENERATE_DIFFERENTIAL_TOOL,
} from '../prompts/differential';
import {
  FhirBundleSchema,
  type FhirBundle,
  type DifferentialOutput,
} from '../lib/schemas';
import { getStore, type TraceEntry } from '../lib/cosmos';

const MAX_RETRIES = 3;

export type DifferentialInput = {
  caseId: string;
  historianOutput: {
    bundle: FhirBundle;
    attempts?: number;
    validationErrors?: string[][];
  };
};

export type DifferentialOutputResult = {
  differential: DifferentialOutput;
  attempts: number;
  validationErrors: string[][];
  warnings: string[];
};

df.app.activity('differential', {
  handler: async (
    raw: unknown,
    context: InvocationContext
  ): Promise<DifferentialOutputResult> => {
    const startedAt = new Date().toISOString();
    const input = raw as DifferentialInput;
    const store = await getStore();

    const trace: TraceEntry = {
      caseId: input.caseId,
      step: 2,
      agent: 'differential',
      status: 'started',
      input: input.historianOutput,
      startedAt,
    };
    await store.writeTrace(trace);

    try {
      const bundle = FhirBundleSchema.parse(input.historianOutput.bundle);
      const result = await runDifferential(bundle, context);

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

async function runDifferential(
  bundle: FhirBundle,
  context: InvocationContext
): Promise<DifferentialOutputResult> {
  const client = getAnthropicClient();
  const userMessage = buildUserMessage(bundle);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  const validationErrors: string[][] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    context.log(`[differential] attempt ${attempt + 1}/${MAX_RETRIES + 1}`);

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: DIFFERENTIAL_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ] as Anthropic.TextBlockParam[],
      tools: [GENERATE_DIFFERENTIAL_TOOL] as unknown as Anthropic.Tool[],
      messages,
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'generate_differential'
    );

    if (!toolUse) {
      const text = response.content.find((b) => b.type === 'text');
      const preview =
        text && 'text' in text ? text.text.slice(0, 200) : '(no text content)';
      const errMsg = `Differential did not call generate_differential. Model said: ${preview}`;
      validationErrors.push([errMsg]);

      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `Differential failed after ${MAX_RETRIES + 1} attempts: ${errMsg}`
        );
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content:
          'You must call the generate_differential tool with your ranked differential. ' +
          'Do not respond with text — call the tool.',
      });
      continue;
    }

    const result = validateDifferential(toolUse.input, bundle);

    if (result.ok) {
      if (result.warnings.length > 0) {
        for (const w of result.warnings) context.log(`[differential] warning: ${w}`);
      }
      return {
        differential: result.differential,
        attempts: attempt + 1,
        validationErrors,
        warnings: result.warnings,
      };
    }

    validationErrors.push(result.errors);

    if (attempt >= MAX_RETRIES) {
      throw new Error(
        `Differential validation failed after ${MAX_RETRIES + 1} attempts. Final errors:\n` +
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
            'Call generate_differential again with a corrected payload that addresses every error above.',
          is_error: true,
        },
      ],
    });
  }

  throw new Error('Differential loop exited unexpectedly');
}

function buildUserMessage(bundle: FhirBundle): string {
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
    for (const v of vitals) {
      const value = formatObservationValue(v);
      lines.push(`- ${v.code.text}: ${value}`);
    }
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
      const value = formatObservationValue(o);
      lines.push(`- ${o.code.text}: ${value}`);
    }
  }

  lines.push('', 'Produce a differential by calling generate_differential.');
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
