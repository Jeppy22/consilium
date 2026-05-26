'use client';

import { useEffect, useState } from 'react';
import { AgentCard, type TraceEntry } from './AgentCard';

type StatusResponse = {
  caseId: string;
  instanceId: string;
  runtimeStatus: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  output?: unknown;
  traces: TraceEntry[];
};

const AGENTS = [
  { key: 'historian', label: 'Historian' },
  { key: 'differential', label: 'Differential' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'devilsAdvocate', label: "Devil's Advocate" },
  { key: 'synthesizer', label: 'Synthesizer' },
] as const;

const TERMINAL = new Set(['Completed', 'Failed', 'Terminated']);
const POLL_INTERVAL_MS = 2000;

export function TraceViewer({
  caseId,
  instanceId,
}: {
  caseId: string;
  instanceId: string;
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(
          `/api/cases/${encodeURIComponent(caseId)}/status?instanceId=${encodeURIComponent(instanceId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Status fetch failed (${res.status})`);
        }
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;
        setStatus(data);
        if (!TERMINAL.has(data.runtimeStatus)) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [caseId, instanceId]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!status) {
    return <p className="text-sm text-slate-500">Loading status…</p>;
  }

  const tracesByAgent = new Map<string, TraceEntry[]>();
  for (const t of status.traces) {
    const arr = tracesByAgent.get(t.agent) ?? [];
    arr.push(t);
    tracesByAgent.set(t.agent, arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="font-mono text-slate-500">caseId: {caseId.slice(0, 8)}…</div>
        <div
          className={`px-2 py-1 rounded text-xs font-medium ${runtimeStatusClass(status.runtimeStatus)}`}
        >
          {status.runtimeStatus}
        </div>
      </div>
      <div className="grid gap-3">
        {AGENTS.map((a) => (
          <AgentCard
            key={a.key}
            label={a.label}
            entries={tracesByAgent.get(a.key) ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function runtimeStatusClass(s: string): string {
  switch (s) {
    case 'Completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'Failed':
    case 'Terminated':
      return 'bg-red-100 text-red-800';
    case 'Running':
      return 'bg-blue-100 text-blue-800';
    case 'Pending':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
