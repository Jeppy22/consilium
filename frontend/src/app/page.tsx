'use client';

import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { CaseForm } from '@/components/CaseForm';
import { LandingScreen } from '@/components/LandingScreen';
import { TraceViewer } from '@/components/TraceViewer';
import type { ClinicalInput } from '@/lib/schemas';

type StartResponse = {
  caseId: string;
  instanceId: string;
  createdAt: string;
  statusUrl: string;
};

type Screen = 'landing' | 'form' | 'trace';

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(input: ClinicalInput) {
    setIsSubmitting(true);
    setSubmitError(null);

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
      setScreen('trace');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetToLanding() {
    setCaseId(null);
    setInstanceId(null);
    setSubmitError(null);
    setScreen('landing');
  }

  if (screen === 'landing') {
    return <LandingScreen onStart={() => setScreen('form')} />;
  }

  if (screen === 'form') {
    return (
      <CaseForm
        onSubmit={handleSubmit}
        onBack={resetToLanding}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={resetToLanding}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </button>
        <button
          type="button"
          onClick={() => setScreen('form')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:text-cyan-300"
        >
          <Plus className="h-3.5 w-3.5" />
          New case
        </button>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Case trace</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Live reasoning pipeline. Watch each agent complete its work.
        </p>
      </header>

      {caseId && instanceId && (
        <TraceViewer caseId={caseId} instanceId={instanceId} />
      )}
    </main>
  );
}
