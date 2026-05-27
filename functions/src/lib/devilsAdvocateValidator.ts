import { z } from 'zod';
import {
  DevilsAdvocateOutputSchema,
  type DevilsAdvocateOutput,
  type FhirBundle,
} from './schemas';

export type DevilsAdvocateValidationResult =
  | { ok: true; critique: DevilsAdvocateOutput; warnings: string[] }
  | { ok: false; errors: string[] };

const SEVERITY_RANK: Record<DevilsAdvocateOutput['critiques'][number]['severity'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function validateDevilsAdvocate(
  input: unknown,
  bundle?: FhirBundle
): DevilsAdvocateValidationResult {
  const parsed = DevilsAdvocateOutputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: formatZodErrors(parsed.error) };
  }

  const orderingErrors = checkOrdering(parsed.data);
  if (orderingErrors.length > 0) {
    return { ok: false, errors: orderingErrors };
  }

  const warnings: string[] = [];
  warnings.push(...checkAssessmentConsistency(parsed.data));
  if (bundle) warnings.push(...checkEvidenceFromBundle(parsed.data, bundle));

  return { ok: true, critique: parsed.data, warnings };
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

function checkOrdering(critique: DevilsAdvocateOutput): string[] {
  const errors: string[] = [];
  const list = critique.critiques;
  for (let i = 1; i < list.length; i++) {
    const prev = SEVERITY_RANK[list[i - 1].severity];
    const cur = SEVERITY_RANK[list[i].severity];
    if (cur > prev) {
      errors.push(
        `critiques must be ordered by severity descending (high → medium → low). ` +
          `Item ${i} (severity "${list[i].severity}") ` +
          `is higher severity than item ${i - 1} (severity "${list[i - 1].severity}").`
      );
    }
  }
  return errors;
}

function checkAssessmentConsistency(critique: DevilsAdvocateOutput): string[] {
  const warnings: string[] = [];
  if (critique.overall_assessment === 'concerning' && critique.agreed_top_diagnosis) {
    warnings.push(
      `overall_assessment is "concerning" but agreed_top_diagnosis is set ` +
        `("${critique.agreed_top_diagnosis}"). These are typically inconsistent.`
    );
  }
  return warnings;
}

function checkEvidenceFromBundle(
  critique: DevilsAdvocateOutput,
  bundle: FhirBundle
): string[] {
  const bundleText = collectBundleText(bundle).toLowerCase();
  const warnings: string[] = [];

  for (let i = 0; i < critique.critiques.length; i++) {
    const c = critique.critiques[i];
    if (c.evidence_from_bundle.length === 0) continue;
    const anyMatched = c.evidence_from_bundle.some((e) =>
      evidenceOverlapsBundle(e, bundleText)
    );
    if (!anyMatched) {
      warnings.push(
        `critique[${i}] targeting "${c.target_diagnosis}" lists evidence_from_bundle ` +
          `that does not appear to reference any text from the FHIR bundle.`
      );
    }
  }

  return warnings;
}

function collectBundleText(bundle: FhirBundle): string {
  const parts: string[] = [];
  for (const entry of bundle.entry) {
    const r = entry.resource;
    if (r.resourceType === 'Condition') {
      parts.push(r.code.text);
    } else if (r.resourceType === 'Observation') {
      parts.push(r.code.text);
      if (r.valueString) parts.push(r.valueString);
      if (r.valueQuantity?.unit) {
        parts.push(`${r.valueQuantity.value} ${r.valueQuantity.unit}`);
      } else if (r.valueQuantity) {
        parts.push(String(r.valueQuantity.value));
      }
      if (r.valueCodeableConcept) parts.push(r.valueCodeableConcept.text);
    } else if (r.resourceType === 'MedicationStatement') {
      parts.push(r.medicationCodeableConcept.text);
    }
  }
  return parts.join(' | ');
}

function evidenceOverlapsBundle(evidence: string, bundleText: string): boolean {
  const words = evidence
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  if (words.length === 0) return true;
  return words.some((w) => bundleText.includes(w));
}

const STOPWORDS = new Set([
  'with',
  'from',
  'this',
  'that',
  'have',
  'been',
  'were',
  'when',
  'then',
  'than',
  'into',
  'over',
  'past',
  'days',
  'weeks',
  'months',
  'years',
  'hour',
  'hours',
  'patient',
  'reports',
  'history',
  'finding',
  'findings',
  'present',
]);
