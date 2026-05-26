'use client';

import { useState } from 'react';
import { ClinicalInputSchema, type ClinicalInput } from '@/lib/schemas';

const SAMPLE: ClinicalInput = {
  age: 58,
  sex: 'male',
  chief_complaint: 'Chest pain',
  duration: '3 hours',
  current_medications: ['Lisinopril 10mg daily', 'Metformin 500mg BID'],
  allergies: ['Penicillin'],
  past_medical_history: ['Hypertension', 'Type 2 diabetes'],
  vital_signs: { bp: '148/92', hr: 96, temp: 37.1, rr: 18, spo2: 97 },
  free_text:
    'Substernal pressure radiating to left arm, worse with exertion. Diaphoretic. No prior cardiac history.',
};

type Props = {
  onSubmit: (input: ClinicalInput) => void;
  isSubmitting: boolean;
};

export function CaseForm({ onSubmit, isSubmitting }: Props) {
  const [age, setAge] = useState(String(SAMPLE.age));
  const [sex, setSex] = useState<ClinicalInput['sex']>(SAMPLE.sex);
  const [chiefComplaint, setChiefComplaint] = useState(SAMPLE.chief_complaint);
  const [duration, setDuration] = useState(SAMPLE.duration);
  const [medications, setMedications] = useState(SAMPLE.current_medications.join(', '));
  const [allergies, setAllergies] = useState(SAMPLE.allergies.join(', '));
  const [pmh, setPmh] = useState(SAMPLE.past_medical_history.join(', '));
  const [bp, setBp] = useState(SAMPLE.vital_signs.bp ?? '');
  const [hr, setHr] = useState(SAMPLE.vital_signs.hr?.toString() ?? '');
  const [temp, setTemp] = useState(SAMPLE.vital_signs.temp?.toString() ?? '');
  const [rr, setRr] = useState(SAMPLE.vital_signs.rr?.toString() ?? '');
  const [spo2, setSpo2] = useState(SAMPLE.vital_signs.spo2?.toString() ?? '');
  const [freeText, setFreeText] = useState(SAMPLE.free_text);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const splitCsv = (s: string) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

    const toNumber = (s: string): number | undefined =>
      s.trim() === '' ? undefined : Number(s);

    const input = {
      age: Number(age),
      sex,
      chief_complaint: chiefComplaint,
      duration,
      current_medications: splitCsv(medications),
      allergies: splitCsv(allergies),
      past_medical_history: splitCsv(pmh),
      vital_signs: {
        bp: bp || undefined,
        hr: toNumber(hr),
        temp: toNumber(temp),
        rr: toNumber(rr),
        spo2: toNumber(spo2),
      },
      free_text: freeText,
    };

    const result = ClinicalInputSchema.safeParse(input);
    if (!result.success) {
      setValidationError(
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      );
      return;
    }
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Age">
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={0}
            max={150}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Sex">
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as ClinicalInput['sex'])}
            className={inputClass}
          >
            <option value="male">male</option>
            <option value="female">female</option>
            <option value="other">other</option>
            <option value="unknown">unknown</option>
          </select>
        </Field>
        <Field label="Duration">
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
            className={inputClass}
            placeholder="e.g. 3 hours, 2 days"
          />
        </Field>
      </div>

      <Field label="Chief complaint">
        <input
          type="text"
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          required
          className={inputClass}
        />
      </Field>

      <fieldset className="border border-slate-200 rounded-md p-4">
        <legend className="text-sm font-medium px-1">Vital signs</legend>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
          <Field label="BP">
            <input
              type="text"
              value={bp}
              onChange={(e) => setBp(e.target.value)}
              className={inputClass}
              placeholder="120/80"
            />
          </Field>
          <Field label="HR (bpm)">
            <input
              type="number"
              value={hr}
              onChange={(e) => setHr(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Temp (°C)">
            <input
              type="number"
              step="0.1"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="RR (/min)">
            <input
              type="number"
              value={rr}
              onChange={(e) => setRr(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="SpO₂ (%)">
            <input
              type="number"
              value={spo2}
              onChange={(e) => setSpo2(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <Field label="Current medications (comma-separated)">
        <input
          type="text"
          value={medications}
          onChange={(e) => setMedications(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Allergies (comma-separated)">
        <input
          type="text"
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Past medical history (comma-separated)">
        <input
          type="text"
          value={pmh}
          onChange={(e) => setPmh(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Narrative / exam findings">
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={4}
          className={inputClass}
        />
      </Field>

      {validationError && (
        <p className="text-sm text-red-600">Validation: {validationError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting…' : 'Submit case'}
        </button>
        <span className="text-xs text-slate-500">
          Form pre-filled with a sample case for testing.
        </span>
      </div>
    </form>
  );
}

const inputClass =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
