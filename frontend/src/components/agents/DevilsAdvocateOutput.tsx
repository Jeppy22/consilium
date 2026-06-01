'use client';

import { DevilsAdvocateOutputSchema, type DevilsAdvocateOutput } from '@/lib/schemas';

function parse(output: unknown): DevilsAdvocateOutput | null {
  if (!output || typeof output !== 'object') return null;
  const wrapper = output as { critique?: unknown };
  const result = DevilsAdvocateOutputSchema.safeParse(wrapper.critique);
  return result.success ? result.data : null;
}

const ASSESSMENT_TONE: Record<DevilsAdvocateOutput['overall_assessment'], string> = {
  solid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  needs_revision: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  concerning: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const SEVERITY_TONE: Record<
  DevilsAdvocateOutput['critiques'][number]['severity'],
  string
> = {
  high: 'bg-red-500/15 text-red-300',
  medium: 'bg-amber-500/15 text-amber-300',
  low: 'bg-zinc-800 text-zinc-400',
};

export function DevilsAdvocateSummary({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;
  const highCount = parsed.critiques.filter((c) => c.severity === 'high').length;
  return (
    <p className="text-sm text-zinc-400">
      Assessment:{' '}
      <span className="font-medium text-zinc-100">
        {parsed.overall_assessment.replace('_', ' ')}
      </span>
      . {parsed.critiques.length} critique{parsed.critiques.length === 1 ? '' : 's'}
      {highCount > 0 && (
        <>
          {' '}
          <span className="text-red-400">• {highCount} high severity</span>
        </>
      )}
      .
    </p>
  );
}

export function DevilsAdvocateDetail({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;

  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Overall assessment
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ASSESSMENT_TONE[parsed.overall_assessment]}`}
          >
            {parsed.overall_assessment.replace('_', ' ')}
          </span>
        </div>
        <p className="text-zinc-300">{parsed.assessment_reasoning}</p>
        {parsed.agreed_top_diagnosis && (
          <p className="mt-1 text-xs text-zinc-500">
            Agreed top diagnosis:{' '}
            <span className="font-medium text-zinc-300">{parsed.agreed_top_diagnosis}</span>
          </p>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Critiques ({parsed.critiques.length})
        </h4>
        <ul className="space-y-3">
          {parsed.critiques.map((c, i) => (
            <li
              key={i}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 backdrop-blur-sm"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_TONE[c.severity]}`}
                >
                  {c.severity}
                </span>
                <span className="font-mono text-xs text-zinc-500">{c.type}</span>
                <span className="text-xs text-zinc-600">→</span>
                <span className="text-xs font-medium text-zinc-200">{c.target_diagnosis}</span>
              </div>
              <p className="text-zinc-300">{c.argument}</p>
              {c.alternative_diagnosis && (
                <p className="mt-1 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">Alternative:</span>{' '}
                  {c.alternative_diagnosis}
                  {c.alternative_icd10_code && (
                    <span className="ml-1 font-mono text-zinc-500">
                      ({c.alternative_icd10_code})
                    </span>
                  )}
                </p>
              )}
              {c.evidence_from_bundle.length > 0 && (
                <p className="mt-1 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">Evidence:</span>{' '}
                  {c.evidence_from_bundle.join('; ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
