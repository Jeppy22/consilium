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
    <p className="text-sm text-slate-600">
      Top diagnosis: <span className="font-medium text-slate-800">{top.diagnosis}</span>{' '}
      ({Math.round(top.confidence * 100)}%). {parsed.ranked_diagnoses.length} ranked total
      {redFlagCount > 0 && (
        <>
          {' '}
          <span className="text-red-600">• {redFlagCount} red flag{redFlagCount === 1 ? '' : 's'}</span>
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
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Clinical impression
        </h4>
        <p className="text-slate-700">{parsed.reasoning_summary}</p>
      </div>

      {parsed.red_flags.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Red flags
          </div>
          <ul className="space-y-1 text-sm text-red-800">
            {parsed.red_flags.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Ranked differential ({parsed.ranked_diagnoses.length})
        </h4>
        <ol className="space-y-3">
          {parsed.ranked_diagnoses.map((d, i) => (
            <li
              key={i}
              className="rounded-md border border-slate-200 bg-white p-3"
            >
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div>
                  <span className="mr-2 font-mono text-xs text-slate-400">#{i + 1}</span>
                  <span className="font-medium text-slate-800">{d.diagnosis}</span>
                  {d.icd10_code && (
                    <span className="ml-2 font-mono text-xs text-slate-500">
                      {d.icd10_code}
                    </span>
                  )}
                </div>
              </div>
              <ConfidenceBar value={d.confidence} tone={i === 0 ? 'blue' : 'slate'} />
              <p className="mt-2 text-slate-600">{d.reasoning}</p>
              {(d.supporting_findings.length > 0 || d.refuting_findings.length > 0) && (
                <div className="mt-2 space-y-1 text-xs">
                  {d.supporting_findings.length > 0 && (
                    <div>
                      <span className="font-semibold text-emerald-700">Supporting: </span>
                      <span className="text-slate-700">
                        {d.supporting_findings.join('; ')}
                      </span>
                    </div>
                  )}
                  {d.refuting_findings.length > 0 && (
                    <div>
                      <span className="font-semibold text-amber-700">Refuting: </span>
                      <span className="text-slate-700">
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
