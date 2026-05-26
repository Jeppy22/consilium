import * as df from 'durable-functions';
import type { InvocationContext } from '@azure/functions';
import { getStore, type TraceEntry } from '../lib/cosmos';

export type EvidenceInput = {
  caseId: string;
  differential: unknown;
};

export type EvidenceOutput = {
  stub: true;
  agent: 'evidence';
  message: string;
};

df.app.activity('evidence', {
  handler: async (raw: unknown, context: InvocationContext): Promise<EvidenceOutput> => {
    const input = raw as EvidenceInput;
    const startedAt = new Date().toISOString();
    const store = await getStore();

    const output: EvidenceOutput = {
      stub: true,
      agent: 'evidence',
      message:
        'Evidence agent not yet implemented (Phase 2; depends on Azure AI Search index).',
    };

    const trace: TraceEntry = {
      caseId: input.caseId,
      step: 3,
      agent: 'evidence',
      status: 'completed',
      input,
      output,
      startedAt,
      completedAt: new Date().toISOString(),
    };
    await store.writeTrace(trace);

    context.log('[evidence] stub invocation');
    return output;
  },
});
