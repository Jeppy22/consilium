import { z } from 'zod';
import {
  SynthesisOutputSchema,
  type SynthesisOutput,
  type DevilsAdvocateOutput,
} from './schemas';

export type SynthesizerValidationResult =
  | { ok: true; synthesis: SynthesisOutput; warnings: string[] }
  | { ok: false; errors: string[] };

export function validateSynthesis(
  input: unknown,
  devilsAdvocate?: DevilsAdvocateOutput
): SynthesizerValidationResult {
  const parsed = SynthesisOutputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: formatZodErrors(parsed.error) };
  }

  const errors: string[] = [];
  errors.push(...checkConfidenceOrdering(parsed.data));
  errors.push(...checkCritiquesAcknowledged(parsed.data, devilsAdvocate));
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const warnings: string[] = [];
  warnings.push(...checkEmergentForRedFlags(parsed.data));

  return { ok: true, synthesis: parsed.data, warnings };
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

function checkConfidenceOrdering(synthesis: SynthesisOutput): string[] {
  const errors: string[] = [];
  const list = synthesis.final_ranked_diagnoses;
  for (let i = 1; i < list.length; i++) {
    if (list[i].final_confidence > list[i - 1].final_confidence) {
      errors.push(
        `final_ranked_diagnoses must be ordered by final_confidence descending. ` +
          `Item ${i} ("${list[i].diagnosis}", final_confidence ${list[i].final_confidence}) ` +
          `has higher confidence than item ${i - 1} ("${list[i - 1].diagnosis}", ` +
          `final_confidence ${list[i - 1].final_confidence}).`
      );
    }
  }
  return errors;
}

function checkCritiquesAcknowledged(
  synthesis: SynthesisOutput,
  devilsAdvocate?: DevilsAdvocateOutput
): string[] {
  if (!devilsAdvocate) return [];
  const critiqueCount = devilsAdvocate.critiques.length;
  if (critiqueCount > 0 && synthesis.acknowledged_critiques.length === 0) {
    return [
      `Devil's Advocate raised ${critiqueCount} critique(s) but acknowledged_critiques is empty. ` +
        `You must include at least one acknowledged_critiques entry explaining how each critique ` +
        `was accepted, partially accepted, or rejected.`,
    ];
  }
  return [];
}

function checkEmergentForRedFlags(synthesis: SynthesisOutput): string[] {
  if (synthesis.red_flags_summary.length === 0) return [];
  const hasEmergent = synthesis.next_steps.some((s) => s.urgency === 'emergent');
  if (hasEmergent) return [];
  return [
    `red_flags_summary is non-empty (${synthesis.red_flags_summary.length} item(s)) but no ` +
      `next_step has urgency "emergent". When red flags are present, at least one emergent ` +
      `action is usually warranted.`,
  ];
}
