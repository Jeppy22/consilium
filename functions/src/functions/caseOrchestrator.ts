import * as df from 'durable-functions';
import type { OrchestrationContext } from 'durable-functions';
import type { ClinicalInput } from '../lib/schemas';

export type OrchestratorInput = {
  caseId: string;
  input: ClinicalInput;
};

df.app.orchestration('caseOrchestrator', function* (context: OrchestrationContext) {
  const { caseId, input } = context.df.getInput() as OrchestratorInput;

  const historian = yield context.df.callActivity('historian', { caseId, input });

  const differential = yield context.df.callActivity('differential', {
    caseId,
    historianOutput: historian,
  });

  const evidence = yield context.df.callActivity('evidence', {
    caseId,
    differential,
  });

  const devilsAdvocate = yield context.df.callActivity('devilsAdvocate', {
    caseId,
    differential,
    evidence,
  });

  const synthesizer = yield context.df.callActivity('synthesizer', {
    caseId,
    historian,
    differential,
    evidence,
    devilsAdvocate,
  });

  return {
    caseId,
    historian,
    differential,
    evidence,
    devilsAdvocate,
    synthesizer,
  };
});
