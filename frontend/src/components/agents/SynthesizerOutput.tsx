'use client';

import { AlertTriangle, GraduationCap } from 'lucide-react';
import { SynthesisOutputSchema, type SynthesisOutput } from '@/lib/schemas';
import { ConfidenceBar } from '../ConfidenceBar';

function parse(output: unknown): SynthesisOutput | null {
  if (!output || typeof output !== 'object') return null;
  const wrapper = output as { synthesis?: unknown };
  const result = SynthesisOutputSchema.safeParse(wrapper.synthesis);
  return result.success ? result.data : null;
}

const URGENCY_DOT: Record<SynthesisOutput['next_steps'][number]['urgency'], string> = {
  emergent: 'bg-red-500',
  urgent: 'bg-amber-500',
  routine: 'bg-slate-400',
};

const RESPONSE_TONE: Record<
  SynthesisOutput['acknowledged_critiques'][number]['response'],
  string
> = {
  accepted: 'bg-emerald-100 text-emerald-800',
  partially_accepted: 'bg-amber-100 text-amber-800',
  rejected: 'bg-slate-100 text-slate-700',
};

export function SynthesizerSummary({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;
  const top = parsed.final_ranked_diagnoses[0];
  return (
    <p className="text-sm text-slate-600">
      Final top: <span className="font-medium text-slate-800">{top.diagnosis}</span>{' '}
      ({Math.round(top.final_confidence * 100)}%). {parsed.next_steps.length} next step
      {parsed.next_steps.length === 1 ? '' : 's'} recommended.
    </p>
  );
}

export function SynthesizerDetail({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;

  return (
    <div className="space-y-5 text-sm">
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Clinical impression
        </h4>
        <p className="text-slate-700 leading-relaxed">{parsed.clinical_impression}</p>
      </div>

      {parsed.red_flags_summary.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Red flags
          </div>
          <ul className="space-y-1 text-sm text-red-800">
            {parsed.red_flags_summary.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Final ranked diagnoses ({parsed.final_ranked_diagnoses.length})
        </h4>
        <ol className="space-y-3">
          {parsed.final_ranked_diagnoses.map((d, i) => (
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
              <ConfidenceBar
                value={d.final_confidence}
                tone={i === 0 ? 'emerald' : 'slate'}
              />
              <p className="mt-2 text-xs text-slate-600 italic">{d.confidence_rationale}</p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Next steps ({parsed.next_steps.length})
        </h4>
        <ul className="space-y-2">
          {parsed.next_steps.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3"
            >
              <span
                className={`mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${URGENCY_DOT[s.urgency]}`}
                aria-label={s.urgency}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {s.category.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    · {s.urgency}
                  </span>
                </div>
                <p className="text-slate-800">{s.action}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s.rationale}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {parsed.acknowledged_critiques.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Responding to Devil&apos;s Advocate
          </h4>
          <ul className="space-y-2">
            {parsed.acknowledged_critiques.map((a, i) => (
              <li
                key={i}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${RESPONSE_TONE[a.response]}`}
                  >
                    {a.response.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-xs text-slate-500">{a.critique_type}</span>
                </div>
                <p className="text-slate-700">{a.reasoning}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
          <GraduationCap className="h-3.5 w-3.5" />
          Teaching point
        </div>
        <p className="text-sm text-blue-900">{parsed.educational_note}</p>
      </div>
    </div>
  );
}
