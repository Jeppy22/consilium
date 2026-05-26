import { randomUUID } from 'crypto';
import * as df from 'durable-functions';
import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';
import { ClinicalInputSchema } from '../lib/schemas';
import { getStore } from '../lib/cosmos';

const durableClientInput = df.input.durableClient();

async function caseHttpStart(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const expected = process.env.CONSILIUM_API_KEY;
  if (!expected) {
    context.error('CONSILIUM_API_KEY is not configured');
    return {
      status: 500,
      jsonBody: { error: 'Server misconfigured: CONSILIUM_API_KEY not set' },
    };
  }

  if (request.headers.get('x-api-key') !== expected) {
    return { status: 401, jsonBody: { error: 'Unauthorized' } };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
  }

  const parsed = ClinicalInputSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      jsonBody: { error: 'Invalid clinical input', issues: parsed.error.issues },
    };
  }

  const caseId = randomUUID();
  const createdAt = new Date().toISOString();

  const store = await getStore();
  await store.writeCase({ caseId, input: parsed.data, createdAt });

  const client = df.getClient(context);
  const instanceId = await client.startNew('caseOrchestrator', {
    input: { caseId, input: parsed.data },
  });

  context.log(`[caseHttpStart] caseId=${caseId} instanceId=${instanceId}`);

  return {
    status: 202,
    jsonBody: {
      caseId,
      instanceId,
      createdAt,
      statusUrl: `/api/cases/${caseId}/status?instanceId=${instanceId}`,
    },
  };
}

app.http('caseHttpStart', {
  route: 'cases',
  methods: ['POST'],
  authLevel: 'anonymous',
  extraInputs: [durableClientInput],
  handler: caseHttpStart,
});
