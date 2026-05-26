'use client';

import { useState } from 'react';
import { CaseForm } from '@/components/CaseForm';
import { TraceViewer } from '@/components/TraceViewer';
import type { ClinicalInput } from '@/lib/schemas';

type StartResponse = {
  caseId: string;
  instanceId: string;
  createdAt: string;
  statusUrl: string;
};

export default function HomePage() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(input: ClinicalInput) {
    setIsSubmitting(true);
    setSubmitError(null);
    setCaseId(null);
    setInstanceId(null);

    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Submit failed with status ${res.status}`);
      }

      const data = (await res.json()) as StartResponse;
      setCaseId(data.caseId);
      setInstanceId(data.instanceId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Consilium</h1>
        <p className="mt-1 text-slate-600">Multi-agent clinical reasoning workbench</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">New case</h2>
        <CaseForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        {submitError && (
          <p className="mt-4 text-sm text-red-600">Error: {submitError}</p>
        )}
      </section>

      {caseId && instanceId && (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Case trace</h2>
          <TraceViewer caseId={caseId} instanceId={instanceId} />
        </section>
      )}
    </main>
  );
}
