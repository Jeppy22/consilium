'use client';

import { AlertTriangle } from 'lucide-react';
import { DifferentialOutputSchema, type DifferentialOutput } from '@/lib/schemas';
import { ConfidenceBar } from '../ConfidenceBar';

function parse(output: unknown): DifferentialOutput | null {
  if (!output || typeof output !== 'object') return null;
  const wrapper = output as { differential?: unknown };
  const result = DifferentialOutputSchema.safeParse(wrapper.differential);
  return result.success ? result.data : null;
}

export function DifferentialSummary({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;
  const top = parsed.ranked_diagnoses[0];
  const redFlagCount = parsed.red_flags.length;
  return (
    <p className="text-sm text-zinc-400">
      Top diagnosis: <span className="font-medium text-zinc-100">{top.diagnosis}</span>{' '}
      ({Math.round(top.confidence * 100)}%). {parsed.ranked_diagnoses.length} ranked total
      {redFlagCount > 0 && (
        <>
          {' '}
          <span className="text-red-400">• {redFlagCount} red flag{redFlagCount === 1 ? '' : 's'}</span>
        </>
      )}
      .
    </p>
  );
}

export function DifferentialDetail({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;

  return (
    <div className="space-y-5 text-sm">
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Clinical impression
        </h4>
        <p className="text-zinc-300">{parsed.reasoning_summary}</p>
      </div>

      {parsed.red_flags.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Red flags
          </div>
          <ul className="space-y-1 text-sm text-red-200">
            {parsed.red_flags.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Ranked differential ({parsed.ranked_diagnoses.length})
        </h4>
        <ol className="space-y-3">
          {parsed.ranked_diagnoses.map((d, i) => (
            <li
              key={i}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 backdrop-blur-sm"
            >
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div>
                  <span className="mr-2 font-mono text-xs text-zinc-500">#{i + 1}</span>
                  <span className="font-medium text-zinc-100">{d.diagnosis}</span>
                  {d.icd10_code && (
                    <span className="ml-2 font-mono text-xs text-zinc-500">
                      {d.icd10_code}
                    </span>
                  )}
                </div>
              </div>
              <ConfidenceBar value={d.confidence} tone={i === 0 ? 'cyan' : 'zinc'} />
              <p className="mt-2 text-zinc-300">{d.reasoning}</p>
              {(d.supporting_findings.length > 0 || d.refuting_findings.length > 0) && (
                <div className="mt-2 space-y-1 text-xs">
                  {d.supporting_findings.length > 0 && (
                    <div>
                      <span className="font-semibold text-emerald-300">Supporting: </span>
                      <span className="text-zinc-300">
                        {d.supporting_findings.join('; ')}
                      </span>
                    </div>
                  )}
                  {d.refuting_findings.length > 0 && (
                    <div>
                      <span className="font-semibold text-amber-300">Refuting: </span>
                      <span className="text-zinc-300">
                        {d.refuting_findings.join('; ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
