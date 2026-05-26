import * as df from 'durable-functions';
import type { InvocationContext } from '@azure/functions';
import { getStore, type TraceEntry } from '../lib/cosmos';

export type DevilsAdvocateInput = {
  caseId: string;
  differential: unknown;
  evidence: unknown;
};

export type DevilsAdvocateOutput = {
  stub: true;
  agent: 'devilsAdvocate';
  message: string;
};

df.app.activity('devilsAdvocate', {
  handler: async (raw: unknown, context: InvocationContext): Promise<DevilsAdvocateOutput> => {
    const input = raw as DevilsAdvocateInput;
    const startedAt = new Date().toISOString();
    const store = await getStore();

    const output: DevilsAdvocateOutput = {
      stub: true,
      agent: 'devilsAdvocate',
      message: "Devil's Advocate agent not yet implemented (Phase 2).",
    };

    const trace: TraceEntry = {
      caseId: input.caseId,
      step: 4,
      agent: 'devilsAdvocate',
      status: 'completed',
      input,
      output,
      startedAt,
      completedAt: new Date().toISOString(),
    };
    await store.writeTrace(trace);

    context.log('[devilsAdvocate] stub invocation');
    return output;
  },
});
