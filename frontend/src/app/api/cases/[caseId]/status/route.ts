import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;

  const base = process.env.FUNCTIONS_BASE_URL;
  const apiKey = process.env.CONSILIUM_API_KEY;
  if (!base || !apiKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const instanceId = request.nextUrl.searchParams.get('instanceId');
  if (!instanceId) {
    return Response.json({ error: 'Missing instanceId query parameter' }, { status: 400 });
  }

  const upstream = await fetch(
    `${base}/api/cases/${encodeURIComponent(caseId)}/status?instanceId=${encodeURIComponent(instanceId)}`,
    { headers: { 'x-api-key': apiKey }, cache: 'no-store' }
  );

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}
