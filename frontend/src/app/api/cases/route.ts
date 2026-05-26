import { NextRequest } from 'next/server';
import { ClinicalInputSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  const base = process.env.FUNCTIONS_BASE_URL;
  const apiKey = process.env.CONSILIUM_API_KEY;
  if (!base || !apiKey) {
    return Response.json(
      { error: 'Server misconfigured: FUNCTIONS_BASE_URL or CONSILIUM_API_KEY not set' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ClinicalInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid clinical input', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const upstream = await fetch(`${base}/api/cases`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(parsed.data),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
