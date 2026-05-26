import * as df from 'durable-functions';
import type { InvocationContext } from '@azure/functions';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, CLAUDE_MODEL } from '../lib/anthropic';
import { validateFhirBundle } from '../lib/fhirValidator';
import {
  HISTORIAN_SYSTEM_PROMPT,
  VALIDATE_FHIR_BUNDLE_TOOL,
} from '../prompts/historian';
import {
  ClinicalInputSchema,
  type ClinicalInput,
  type FhirBundle,
} from '../lib/schemas';
import { getStore, type TraceEntry } from '../lib/cosmos';

const MAX_RETRIES = 3;

export type HistorianInput = {
  caseId: string;
  input: ClinicalInput;
};

export type HistorianOutput = {
  bundle: FhirBundle;
  attempts: number;
  validationErrors: string[][];
};

df.app.activity('historian', {
  handler: async (raw: unknown, context: InvocationContext): Promise<HistorianOutput> => {
    const startedAt = new Date().toISOString();
    const input = raw as HistorianInput;
    const store = await getStore();

    const trace: TraceEntry = {
      caseId: input.caseId,
      step: 1,
      agent: 'historian',
      status: 'started',
      input: input.input,
      startedAt,
    };
    await store.writeTrace(trace);

    try {
      const validated = ClinicalInputSchema.parse(input.input);
      const result = await runHistorian(validated, context);

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

async function runHistorian(
  input: ClinicalInput,
  context: InvocationContext
): Promise<HistorianOutput> {
  const client = getAnthropicClient();
  const userMessage = buildUserMessage(input);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  const validationErrors: string[][] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    context.log(`[historian] attempt ${attempt + 1}/${MAX_RETRIES + 1}`);

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: HISTORIAN_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ] as Anthropic.TextBlockParam[],
      tools: [VALIDATE_FHIR_BUNDLE_TOOL] as unknown as Anthropic.Tool[],
      messages,
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'validate_fhir_bundle'
    );

    if (!toolUse) {
      const text = response.content.find((b) => b.type === 'text');
      const preview =
        text && 'text' in text ? text.text.slice(0, 200) : '(no text content)';
      const errMsg = `Historian did not call validate_fhir_bundle. Model said: ${preview}`;
      validationErrors.push([errMsg]);

      if (attempt >= MAX_RETRIES) {
        throw new Error(`Historian failed after ${MAX_RETRIES + 1} attempts: ${errMsg}`);
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content:
          'You must call the validate_fhir_bundle tool with your proposed bundle. ' +
          'Do not respond with text — call the tool.',
      });
      continue;
    }

    const proposed = (toolUse.input as { bundle?: unknown }).bundle;
    const result = validateFhirBundle(proposed);

    if (result.ok) {
      return { bundle: result.bundle, attempts: attempt + 1, validationErrors };
    }

    validationErrors.push(result.errors);

    if (attempt >= MAX_RETRIES) {
      throw new Error(
        `Historian validation failed after ${MAX_RETRIES + 1} attempts. Final errors:\n` +
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
            'Call validate_fhir_bundle again with a corrected bundle that addresses every error above.',
          is_error: true,
        },
      ],
    });
  }

  throw new Error('Historian loop exited unexpectedly');
}

function buildUserMessage(input: ClinicalInput): string {
  const lines: string[] = [];
  lines.push('# Clinical case', '');
  lines.push(`**Demographics:** ${input.age} year old ${input.sex}`);
  lines.push(`**Chief complaint:** ${input.chief_complaint}`);
  lines.push(`**Duration:** ${input.duration}`);
  lines.push('', '**Vital signs:**');

  const vs = input.vital_signs;
  const vsLines: string[] = [];
  if (vs.bp) vsLines.push(`- BP: ${vs.bp}`);
  if (vs.hr !== undefined) vsLines.push(`- HR: ${vs.hr} bpm`);
  if (vs.temp !== undefined) vsLines.push(`- Temp: ${vs.temp} C`);
  if (vs.rr !== undefined) vsLines.push(`- RR: ${vs.rr} /min`);
  if (vs.spo2 !== undefined) vsLines.push(`- SpO2: ${vs.spo2}%`);
  lines.push(vsLines.length ? vsLines.join('\n') : '(none provided)');

  lines.push('');
  lines.push(
    `**Current medications:** ${
      input.current_medications.length ? input.current_medications.join(', ') : '(none)'
    }`
  );
  lines.push(
    `**Allergies:** ${
      input.allergies.length ? input.allergies.join(', ') : '(none known)'
    }`
  );
  lines.push(
    `**Past medical history:** ${
      input.past_medical_history.length ? input.past_medical_history.join(', ') : '(none)'
    }`
  );
  lines.push('', '**Narrative / exam findings:**');
  lines.push(input.free_text || '(none)');
  lines.push('', 'Produce a FHIR Bundle by calling validate_fhir_bundle.');

  return lines.join('\n');
}
