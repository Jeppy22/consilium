'use client';

import { useState } from 'react';
import { ArrowLeft, Sparkles, ClipboardList } from 'lucide-react';
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
  onBack: () => void;
  isSubmitting: boolean;
  submitError: string | null;
};

export function CaseForm({ onSubmit, onBack, isSubmitting, submitError }: Props) {
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<ClinicalInput['sex']>('male');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [duration, setDuration] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [pmh, setPmh] = useState('');
  const [bp, setBp] = useState('');
  const [hr, setHr] = useState('');
  const [temp, setTemp] = useState('');
  const [rr, setRr] = useState('');
  const [spo2, setSpo2] = useState('');
  const [freeText, setFreeText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function loadSample() {
    setAge(String(SAMPLE.age));
    setSex(SAMPLE.sex);
    setChiefComplaint(SAMPLE.chief_complaint);
    setDuration(SAMPLE.duration);
    setMedications(SAMPLE.current_medications.join(', '));
    setAllergies(SAMPLE.allergies.join(', '));
    setPmh(SAMPLE.past_medical_history.join(', '));
    setBp(SAMPLE.vital_signs.bp ?? '');
    setHr(SAMPLE.vital_signs.hr?.toString() ?? '');
    setTemp(SAMPLE.vital_signs.temp?.toString() ?? '');
    setRr(SAMPLE.vital_signs.rr?.toString() ?? '');
    setSpo2(SAMPLE.vital_signs.spo2?.toString() ?? '');
    setFreeText(SAMPLE.free_text);
    setValidationError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const splitCsv = (s: string) =>
      s.split(',').map((x) => x.trim()).filter(Boolean);

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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={loadSample}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:text-cyan-300"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Load sample case
        </button>
      </div>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">New case</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Enter clinical data or load the sample case. The five agents will reason
          through it in sequence.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Demographics">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              placeholder="e.g. Chest pain"
            />
          </Field>
        </Section>

        <Section title="Vital signs">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
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
        </Section>

        <Section title="History">
          <Field label="Current medications (comma-separated)">
            <input
              type="text"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              className={inputClass}
              placeholder="e.g. Lisinopril 10mg daily, Metformin 500mg BID"
            />
          </Field>
          <Field label="Allergies (comma-separated)">
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className={inputClass}
              placeholder="e.g. Penicillin"
            />
          </Field>
          <Field label="Past medical history (comma-separated)">
            <input
              type="text"
              value={pmh}
              onChange={(e) => setPmh(e.target.value)}
              className={inputClass}
              placeholder="e.g. Hypertension, Type 2 diabetes"
            />
          </Field>
          <Field label="Narrative / exam findings">
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Free text — symptoms, exam, context."
            />
          </Field>
        </Section>

        {(validationError || submitError) && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {submitError ?? `Validation: ${validationError}`}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_0_30px_-5px_rgba(34,211,238,0.5)] transition-all duration-200 hover:bg-cyan-400 hover:shadow-[0_0_40px_-5px_rgba(34,211,238,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isSubmitting ? 'Submitting…' : 'Run analysis'}
          </button>
        </div>
      </form>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const inputClass =
  'block w-full rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
