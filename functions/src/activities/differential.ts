import * as df from 'durable-functions';
import type { InvocationContext } from '@azure/functions';
import { getStore, type TraceEntry } from '../lib/cosmos';

export type DifferentialInput = {
  caseId: string;
  fhirBundle: unknown;
};

export type DifferentialOutput = {
  stub: true;
  agent: 'differential';
  message: string;
};

df.app.activity('differential', {
  handler: async (raw: unknown, context: InvocationContext): Promise<DifferentialOutput> => {
    const input = raw as DifferentialInput;
    const startedAt = new Date().toISOString();
    const store = await getStore();

    const output: DifferentialOutput = {
      stub: true,
      agent: 'differential',
      message: 'Differential agent not yet implemented (Phase 2).',
    };

    const trace: TraceEntry = {
      caseId: input.caseId,
      step: 2,
      agent: 'differential',
      status: 'completed',
      input,
      output,
      startedAt,
      completedAt: new Date().toISOString(),
    };
    await store.writeTrace(trace);

    context.log('[differential] stub invocation');
    return output;
  },
});
