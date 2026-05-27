import { z } from 'zod';
import {
  DifferentialOutputSchema,
  type DifferentialOutput,
  type FhirBundle,
} from './schemas';

export type DifferentialValidationResult =
  | { ok: true; differential: DifferentialOutput; warnings: string[] }
  | { ok: false; errors: string[] };

export function validateDifferential(
  input: unknown,
  bundle?: FhirBundle
): DifferentialValidationResult {
  const parsed = DifferentialOutputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: formatZodErrors(parsed.error) };
  }

  const orderingErrors = checkOrdering(parsed.data);
  if (orderingErrors.length > 0) {
    return { ok: false, errors: orderingErrors };
  }

  const warnings = bundle ? checkSupportingFindings(parsed.data, bundle) : [];
  return { ok: true, differential: parsed.data, warnings };
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

function checkOrdering(differential: DifferentialOutput): string[] {
  const errors: string[] = [];
  const list = differential.ranked_diagnoses;
  for (let i = 1; i < list.length; i++) {
    if (list[i].confidence > list[i - 1].confidence) {
      errors.push(
        `ranked_diagnoses must be ordered by confidence descending. ` +
          `Item ${i} ("${list[i].diagnosis}", confidence ${list[i].confidence}) ` +
          `has higher confidence than item ${i - 1} ("${list[i - 1].diagnosis}", ` +
          `confidence ${list[i - 1].confidence}).`
      );
    }
  }
  return errors;
}

function checkSupportingFindings(
  differential: DifferentialOutput,
  bundle: FhirBundle
): string[] {
  const bundleText = collectBundleText(bundle).toLowerCase();
  const warnings: string[] = [];

  for (const dx of differential.ranked_diagnoses) {
    const anyMatched = dx.supporting_findings.some((f) =>
      findingOverlapsBundle(f, bundleText)
    );
    if (!anyMatched && dx.supporting_findings.length > 0) {
      warnings.push(
        `Diagnosis "${dx.diagnosis}" lists supporting_findings that do not appear ` +
          `to reference any text from the FHIR bundle.`
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

function findingOverlapsBundle(finding: string, bundleText: string): boolean {
  const words = finding
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
