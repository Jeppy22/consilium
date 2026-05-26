import * as df from 'durable-functions';
import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { getStore } from '../lib/cosmos';

const durableClientInput = df.input.durableClient();

async function caseStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const expected = process.env.CONSILIUM_API_KEY;
  if (!expected) {
    return { status: 500, jsonBody: { error: 'Server misconfigured' } };
  }

  if (request.headers.get('x-api-key') !== expected) {
    return { status: 401, jsonBody: { error: 'Unauthorized' } };
  }

  const caseId = request.params.caseId;
  const instanceId = request.query.get('instanceId');
  if (!caseId) {
    return { status: 400, jsonBody: { error: 'Missing caseId path parameter' } };
  }
  if (!instanceId) {
    return { status: 400, jsonBody: { error: 'Missing instanceId query parameter' } };
  }

  const client = df.getClient(context);
  const status = await client.getStatus(instanceId, {
    showInput: false,
    showHistory: false,
  });

  const store = await getStore();
  const traces = await store.getTraces(caseId);

  context.log(`[caseStatus] caseId=${caseId} runtimeStatus=${status?.runtimeStatus}`);

  return {
    status: 200,
    jsonBody: {
      caseId,
      instanceId,
      runtimeStatus: status?.runtimeStatus ?? 'Unknown',
      createdTime: status?.createdTime,
      lastUpdatedTime: status?.lastUpdatedTime,
      output: status?.output,
      traces,
    },
  };
}

app.http('caseStatus', {
  route: 'cases/{caseId}/status',
  methods: ['GET'],
  authLevel: 'anonymous',
  extraInputs: [durableClientInput],
  handler: caseStatus,
});
