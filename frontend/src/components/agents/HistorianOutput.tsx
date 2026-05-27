'use client';

import { FhirBundleSchema, type FhirBundle } from '@/lib/schemas';

type Parsed = { bundle: FhirBundle } | null;

function parse(output: unknown): Parsed {
  if (!output || typeof output !== 'object') return null;
  const wrapper = output as { bundle?: unknown };
  const result = FhirBundleSchema.safeParse(wrapper.bundle);
  return result.success ? { bundle: result.data } : null;
}

export function HistorianSummary({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;
  const counts = countResources(parsed.bundle);
  const bits: string[] = [];
  bits.push(`${counts.conditions} condition${counts.conditions === 1 ? '' : 's'}`);
  bits.push(`${counts.observations} observation${counts.observations === 1 ? '' : 's'}`);
  if (counts.medications) {
    bits.push(`${counts.medications} medication${counts.medications === 1 ? '' : 's'}`);
  }
  return (
    <p className="text-sm text-slate-600">
      FHIR bundle extracted: {bits.join(', ')}.
    </p>
  );
}

export function HistorianDetail({ output }: { output: unknown }) {
  const parsed = parse(output);
  if (!parsed) return null;
  const bundle = parsed.bundle;

  const patient = bundle.entry.find((e) => e.resource.resourceType === 'Patient')?.resource as
    | { resourceType: 'Patient'; gender?: string; birthDate?: string; id: string }
    | undefined;
  const conditions = bundle.entry
    .map((e) => e.resource)
    .filter((r): r is Extract<typeof r, { resourceType: 'Condition' }> =>
      r.resourceType === 'Condition'
    );
  const observations = bundle.entry
    .map((e) => e.resource)
    .filter((r): r is Extract<typeof r, { resourceType: 'Observation' }> =>
      r.resourceType === 'Observation'
    );
  const medications = bundle.entry
    .map((e) => e.resource)
    .filter((r): r is Extract<typeof r, { resourceType: 'MedicationStatement' }> =>
      r.resourceType === 'MedicationStatement'
    );

  return (
    <div className="space-y-4 text-sm">
      <Section title="Patient">
        <p className="text-slate-700">
          {patient?.gender ?? 'unknown'}
          {patient?.birthDate ? `, born ${patient.birthDate}` : ''}
        </p>
      </Section>

      {conditions.length > 0 && (
        <Section title={`Conditions (${conditions.length})`}>
          <ul className="space-y-1">
            {conditions.map((c) => (
              <li key={c.id} className="text-slate-700">
                <span className="font-medium">{c.code.text}</span>
                {c.clinicalStatus?.coding?.[0]?.code && (
                  <span className="ml-2 text-xs text-slate-500">
                    ({c.clinicalStatus.coding[0].code})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {observations.length > 0 && (
        <Section title={`Observations (${observations.length})`}>
          <ul className="space-y-1">
            {observations.map((o) => (
              <li key={o.id} className="text-slate-700">
                <span className="font-medium">{o.code.text}:</span>{' '}
                <span>{formatValue(o)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {medications.length > 0 && (
        <Section title={`Medications (${medications.length})`}>
          <ul className="space-y-1">
            {medications.map((m) => (
              <li key={m.id} className="text-slate-700">
                <span className="font-medium">{m.medicationCodeableConcept.text}</span>
                <span className="ml-2 text-xs text-slate-500">({m.status})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h4>
      {children}
    </div>
  );
}

function formatValue(o: {
  valueString?: string;
  valueQuantity?: { value: number; unit?: string };
  valueCodeableConcept?: { text: string };
}): string {
  if (o.valueString) return o.valueString;
  if (o.valueQuantity) {
    return o.valueQuantity.unit
      ? `${o.valueQuantity.value} ${o.valueQuantity.unit}`
      : String(o.valueQuantity.value);
  }
  if (o.valueCodeableConcept) return o.valueCodeableConcept.text;
  return '—';
}

function countResources(bundle: FhirBundle) {
  let conditions = 0;
  let observations = 0;
  let medications = 0;
  for (const e of bundle.entry) {
    if (e.resource.resourceType === 'Condition') conditions++;
    else if (e.resource.resourceType === 'Observation') observations++;
    else if (e.resource.resourceType === 'MedicationStatement') medications++;
  }
  return { conditions, observations, medications };
}
