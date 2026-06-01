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
  emergent: 'bg-red-400',
  urgent: 'bg-amber-400',
  routine: 'bg-zinc-500',
};

const RESPONSE_TONE: Record<
  SynthesisOutput['acknowledged_critiques'][number]['response'],
  string
> = {
  accepted: 'bg-emerald-500/15 text-emerald-300',
  partially_accepted: 'bg-amber-500/15 text-amber-300',
  rejected: 'bg-zinc-800 text-zinc-400',
};

export function SynthesizerSummary({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;
  const top = parsed.final_ranked_diagnoses[0];
  return (
    <p className="text-sm text-zinc-400">
      Final top: <span className="font-medium text-zinc-100">{top.diagnosis}</span>{' '}
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
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Clinical impression
        </h4>
        <p className="leading-relaxed text-zinc-300">{parsed.clinical_impression}</p>
      </div>

      {parsed.red_flags_summary.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Red flags
          </div>
          <ul className="space-y-1 text-sm text-red-200">
            {parsed.red_flags_summary.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Final ranked diagnoses ({parsed.final_ranked_diagnoses.length})
        </h4>
        <ol className="space-y-3">
          {parsed.final_ranked_diagnoses.map((d, i) => (
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
              <ConfidenceBar
                value={d.final_confidence}
                tone={i === 0 ? 'emerald' : 'zinc'}
              />
              <p className="mt-2 text-xs italic text-zinc-400">{d.confidence_rationale}</p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Next steps ({parsed.next_steps.length})
        </h4>
        <ul className="space-y-2">
          {parsed.next_steps.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 backdrop-blur-sm"
            >
              <span
                className={`mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${URGENCY_DOT[s.urgency]}`}
                aria-label={s.urgency}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    {s.category.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    · {s.urgency}
                  </span>
                </div>
                <p className="text-zinc-100">{s.action}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{s.rationale}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {parsed.acknowledged_critiques.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Responding to Devil&apos;s Advocate
          </h4>
          <ul className="space-y-2">
            {parsed.acknowledged_critiques.map((a, i) => (
              <li
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 backdrop-blur-sm"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${RESPONSE_TONE[a.response]}`}
                  >
                    {a.response.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">{a.critique_type}</span>
                </div>
                <p className="text-zinc-300">{a.reasoning}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <GraduationCap className="h-3.5 w-3.5" />
          Teaching point
        </div>
        <p className="text-sm text-cyan-100">{parsed.educational_note}</p>
      </div>
    </div>
  );
}
