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

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  started: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

export function AgentCard({
  label,
  entries,
}: {
  label: string;
  entries: TraceEntry[];
}) {
  const latest = entries[entries.length - 1];
  const status = latest?.status ?? 'pending';

  return (
    <details className="rounded-md border border-slate-200 bg-slate-50/40 p-3 open:bg-white open:shadow-sm">
      <summary className="flex items-center justify-between cursor-pointer text-sm font-medium select-none">
        <span>{label}</span>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            STATUS_CLASS[status] ?? STATUS_CLASS.pending
          }`}
        >
          {status}
        </span>
      </summary>

      {latest ? (
        <div className="mt-3 text-xs space-y-2">
          <div className="text-slate-500">
            started {new Date(latest.startedAt).toLocaleTimeString()}
            {latest.completedAt &&
              ` · finished ${new Date(latest.completedAt).toLocaleTimeString()}`}
          </div>
          {latest.error && (
            <pre className="text-red-700 bg-red-50 p-2 rounded whitespace-pre-wrap">
              {latest.error}
            </pre>
          )}
          {latest.output !== undefined && (
            <pre className="bg-slate-100 p-2 rounded overflow-auto max-h-80 text-[11px]">
              {JSON.stringify(latest.output, null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Waiting for this agent to start…</p>
      )}
    </details>
  );
}
