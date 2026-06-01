'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AgentCard, type TraceEntry } from './AgentCard';
import { AgentPipeline } from './AgentPipeline';
import type { AgentStatus } from './AgentNode';

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
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    if (status && TERMINAL.has(status.runtimeStatus)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  const tracesByAgent = useMemo(() => {
    const map = new Map<string, TraceEntry[]>();
    if (!status) return map;
    for (const t of status.traces) {
      const arr = map.get(t.agent) ?? [];
      arr.push(t);
      map.set(t.agent, arr);
    }
    return map;
  }, [status]);

  const agentStatuses = useMemo<Record<string, AgentStatus>>(() => {
    const out: Record<string, AgentStatus> = {};
    for (const a of AGENTS) {
      const entries = tracesByAgent.get(a.key);
      const latest = entries?.[entries.length - 1];
      if (!latest) out[a.key] = 'pending';
      else if (latest.status === 'started') out[a.key] = 'running';
      else if (latest.status === 'completed') out[a.key] = 'completed';
      else out[a.key] = 'failed';
    }
    return out;
  }, [tracesByAgent]);

  const elapsedMs = useMemo(() => {
    if (!status || status.traces.length === 0) return 0;
    const startMs = Math.min(
      ...status.traces.map((t) => new Date(t.startedAt).getTime())
    );
    if (TERMINAL.has(status.runtimeStatus)) {
      const completedTimes = status.traces
        .map((t) => (t.completedAt ? new Date(t.completedAt).getTime() : null))
        .filter((v): v is number => v !== null);
      if (completedTimes.length > 0) {
        return Math.max(...completedTimes) - startMs;
      }
    }
    return now - startMs;
  }, [status, now]);

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
        {error}
      </p>
    );
  }
  if (!status) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading status…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <StatusHeader
        caseId={caseId}
        runtimeStatus={status.runtimeStatus}
        createdTime={status.createdTime}
        elapsedMs={elapsedMs}
      />

      <AgentPipeline statuses={agentStatuses} />

      <div className="space-y-3">
        {AGENTS.map((a) => {
          const entries = tracesByAgent.get(a.key) ?? [];
          const s = agentStatuses[a.key];
          return (
            <AgentCard
              key={a.key}
              agentKey={a.key}
              label={a.label}
              status={s}
              entries={entries}
              autoExpand={s === 'running'}
            />
          );
        })}
      </div>
    </div>
  );
}

function StatusHeader({
  caseId,
  runtimeStatus,
  createdTime,
  elapsedMs,
}: {
  caseId: string;
  runtimeStatus: string;
  createdTime?: string;
  elapsedMs: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-6">
        <HeaderField label="case ID" value={`${caseId.slice(0, 8)}…`} mono />
        {createdTime && (
          <HeaderField
            label="submitted"
            value={new Date(createdTime).toLocaleTimeString()}
          />
        )}
        <HeaderField label="elapsed" value={formatElapsed(elapsedMs)} mono />
      </div>
      <RuntimeBadge status={runtimeStatus} />
    </div>
  );
}

function HeaderField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={`text-sm text-zinc-200 ${mono ? 'font-mono tabular-nums' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function RuntimeBadge({ status }: { status: string }) {
  const tone = runtimeBadgeTone(status);
  const pulsing = status === 'Running' || status === 'Pending';
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {pulsing && (
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
      )}
      <span>{status}</span>
    </div>
  );
}

function runtimeBadgeTone(s: string): string {
  switch (s) {
    case 'Completed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'Failed':
    case 'Terminated':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    case 'Running':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case 'Pending':
      return 'border-zinc-700 bg-zinc-800/60 text-zinc-300';
    default:
      return 'border-zinc-700 bg-zinc-800/60 text-zinc-300';
  }
}

function formatElapsed(ms: number): string {
  if (ms <= 0) return '0.0s';
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}
