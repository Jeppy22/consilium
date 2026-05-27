'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentStatus } from './AgentNode';
import {
  HistorianSummary,
  HistorianDetail,
} from './agents/HistorianOutput';
import {
  DifferentialSummary,
  DifferentialDetail,
} from './agents/DifferentialOutput';
import {
  DevilsAdvocateSummary,
  DevilsAdvocateDetail,
} from './agents/DevilsAdvocateOutput';
import {
  SynthesizerSummary,
  SynthesizerDetail,
} from './agents/SynthesizerOutput';
import { EvidenceSummary, EvidenceDetail } from './agents/EvidenceOutput';

export type TraceEntry = {
  caseId: string;
  step: number;
  agent: string;
  status: 'started' | 'completed' | 'failed';
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
};

const BADGE_TONE: Record<AgentStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

export function AgentCard({
  agentKey,
  label,
  status,
  entries,
  autoExpand,
}: {
  agentKey: string;
  label: string;
  status: AgentStatus;
  entries: TraceEntry[];
  autoExpand: boolean;
}) {
  const latest = entries[entries.length - 1];
  const [expanded, setExpanded] = useState(autoExpand);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setExpanded(autoExpand);
  }, [autoExpand]);

  return (
    <div
      className={`rounded-lg border bg-white transition-all duration-300 ${
        status === 'running'
          ? 'border-blue-200 shadow-sm ring-1 ring-blue-100'
          : status === 'failed'
            ? 'border-red-200'
            : 'border-slate-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            step {latest?.step ?? '–'}
          </span>
          <span className="font-medium text-slate-800">{label}</span>
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE[status]}`}
        >
          {status}
        </span>
      </button>

      {!expanded && latest && status === 'completed' && (
        <div className="px-4 pb-3">
          <AgentSummary agentKey={agentKey} output={latest.output} />
        </div>
      )}

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4">
          {latest ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>
                  started {new Date(latest.startedAt).toLocaleTimeString()}
                </span>
                {latest.completedAt && (
                  <>
                    <span>·</span>
                    <span>
                      finished {new Date(latest.completedAt).toLocaleTimeString()}
                    </span>
                    <span>·</span>
                    <span>{formatDuration(latest.startedAt, latest.completedAt)}</span>
                  </>
                )}
              </div>

              {latest.error && (
                <pre className="whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs text-red-700">
                  {latest.error}
                </pre>
              )}

              {latest.status === 'started' && !latest.error && (
                <p className="text-sm text-slate-500">Running…</p>
              )}

              {latest.output !== undefined && (
                <>
                  <AgentDetail agentKey={agentKey} output={latest.output} />
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRaw((v) => !v)}
                      className="text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                    >
                      {showRaw ? 'Hide raw JSON' : 'View raw JSON'}
                    </button>
                    {showRaw && (
                      <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-50 p-3 text-[11px] text-slate-700">
                        {JSON.stringify(latest.output, null, 2)}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Waiting for this agent to start…</p>
          )}
        </div>
      )}
    </div>
  );
}

function AgentSummary({
  agentKey,
  output,
}: {
  agentKey: string;
  output: unknown;
}) {
  switch (agentKey) {
    case 'historian':
      return <HistorianSummary output={output} />;
    case 'differential':
      return <DifferentialSummary output={output} />;
    case 'devilsAdvocate':
      return <DevilsAdvocateSummary output={output} />;
    case 'synthesizer':
      return <SynthesizerSummary output={output} />;
    case 'evidence':
      return <EvidenceSummary />;
    default:
      return null;
  }
}

function AgentDetail({
  agentKey,
  output,
}: {
  agentKey: string;
  output: unknown;
}) {
  const rendered = (() => {
    switch (agentKey) {
      case 'historian':
        return <HistorianDetail output={output} />;
      case 'differential':
        return <DifferentialDetail output={output} />;
      case 'devilsAdvocate':
        return <DevilsAdvocateDetail output={output} />;
      case 'synthesizer':
        return <SynthesizerDetail output={output} />;
      case 'evidence':
        return <EvidenceDetail />;
      default:
        return null;
    }
  })();

  if (rendered) return rendered;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      Output did not match the expected schema for this agent. Raw JSON below.
    </div>
  );
}

function formatDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
