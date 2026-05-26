import * as df from 'durable-functions';
import type { InvocationContext } from '@azure/functions';
import { getStore, type TraceEntry } from '../lib/cosmos';

export type SynthesizerInput = {
  caseId: string;
  historian: unknown;
  differential: unknown;
  evidence: unknown;
  devilsAdvocate: unknown;
};

export type SynthesizerOutput = {
  stub: true;
  agent: 'synthesizer';
  message: string;
};

df.app.activity('synthesizer', {
  handler: async (raw: unknown, context: InvocationContext): Promise<SynthesizerOutput> => {
    const input = raw as SynthesizerInput;
    const startedAt = new Date().toISOString();
    const store = await getStore();

    const output: SynthesizerOutput = {
      stub: true,
      agent: 'synthesizer',
      message: 'Synthesizer agent not yet implemented (Phase 2).',
    };

    const trace: TraceEntry = {
      caseId: input.caseId,
      step: 5,
      agent: 'synthesizer',
      status: 'completed',
      input,
      output,
      startedAt,
      completedAt: new Date().toISOString(),
    };
    await store.writeTrace(trace);

    context.log('[synthesizer] stub invocation');
    return output;
  },
});
