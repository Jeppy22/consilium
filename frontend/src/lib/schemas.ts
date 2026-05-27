// =====================================================================
// Consilium schemas — frontend/ copy.
//
// IMPORTANT: This file is intentionally duplicated from
// functions/src/lib/schemas.ts. The two copies must stay in sync.
// We do NOT share via a file:../shared package — that broke on Windows
// in a prior attempt. Schemas are small and stable; duplication is the cure.
// =====================================================================

import { z } from 'zod';

// ---------------------------------------------------------------------
// ClinicalInput — the structured payload the frontend submits
// ---------------------------------------------------------------------

export const VitalSignsSchema = z.object({
  bp: z.string().optional(),
  hr: z.number().int().min(0).max(400).optional(),
  temp: z.number().min(20).max(45).optional(),
  rr: z.number().int().min(0).max(80).optional(),
  spo2: z.number().int().min(0).max(100).optional(),
});

export const ClinicalInputSchema = z.object({
  age: z.number().int().min(0).max(150),
  sex: z.enum(['male', 'female', 'other', 'unknown']),
  chief_complaint: z.string().min(1),
  duration: z.string().min(1),
  current_medications: z.array(z.string()),
  allergies: z.array(z.string()),
  past_medical_history: z.array(z.string()),
  vital_signs: VitalSignsSchema,
  free_text: z.string(),
});

export type ClinicalInput = z.infer<typeof ClinicalInputSchema>;
export type VitalSigns = z.infer<typeof VitalSignsSchema>;

// ---------------------------------------------------------------------
// FHIR-shaped Bundle — permissive Consilium subset of FHIR R4.
// Required fields only; no enforced terminology bindings.
// ---------------------------------------------------------------------

const SubjectRefSchema = z.object({
  reference: z.string().min(1),
});

const CodingSchema = z.object({
  system: z.string().optional(),
  code: z.string().optional(),
  display: z.string().optional(),
});

const CodeableConceptSchema = z.object({
  text: z.string().min(1),
  coding: z.array(CodingSchema).optional(),
});

const QuantitySchema = z.object({
  value: z.number(),
  unit: z.string().optional(),
});

export const PatientSchema = z.object({
  resourceType: z.literal('Patient'),
  id: z.string().min(1),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(),
});

export const ConditionSchema = z.object({
  resourceType: z.literal('Condition'),
  id: z.string().min(1),
  subject: SubjectRefSchema,
  code: CodeableConceptSchema,
  clinicalStatus: z
    .object({
      coding: z.array(CodingSchema).optional(),
      text: z.string().optional(),
    })
    .optional(),
  recordedDate: z.string().optional(),
});

export const ObservationSchema = z.object({
  resourceType: z.literal('Observation'),
  id: z.string().min(1),
  status: z.enum(['registered', 'preliminary', 'final', 'amended', 'corrected']),
  subject: SubjectRefSchema,
  code: CodeableConceptSchema,
  valueQuantity: QuantitySchema.optional(),
  valueString: z.string().optional(),
  valueCodeableConcept: CodeableConceptSchema.optional(),
  effectiveDateTime: z.string().optional(),
});

export const MedicationStatementSchema = z.object({
  resourceType: z.literal('MedicationStatement'),
  id: z.string().min(1),
  status: z.enum([
    'active',
    'completed',
    'stopped',
    'on-hold',
    'unknown',
    'entered-in-error',
    'intended',
    'not-taken',
  ]),
  subject: SubjectRefSchema,
  medicationCodeableConcept: CodeableConceptSchema,
});

export const FhirResourceSchema = z.discriminatedUnion('resourceType', [
  PatientSchema,
  ConditionSchema,
  ObservationSchema,
  MedicationStatementSchema,
]);

export const BundleEntrySchema = z.object({
  fullUrl: z.string().optional(),
  resource: FhirResourceSchema,
});

export const FhirBundleSchema = z.object({
  resourceType: z.literal('Bundle'),
  type: z.literal('collection'),
  entry: z.array(BundleEntrySchema),
});

export type FhirBundle = z.infer<typeof FhirBundleSchema>;
export type FhirResource = z.infer<typeof FhirResourceSchema>;
export type Patient = z.infer<typeof PatientSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type MedicationStatement = z.infer<typeof MedicationStatementSchema>;

// ---------------------------------------------------------------------
// Differential — output of the Differential agent.
// Ranked clinical differential diagnoses with confidence and reasoning.
// ---------------------------------------------------------------------

export const DifferentialDiagnosisSchema = z.object({
  diagnosis: z.string().min(1),
  icd10_code: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  supporting_findings: z.array(z.string()),
  refuting_findings: z.array(z.string()),
});

export const DifferentialOutputSchema = z.object({
  ranked_diagnoses: z.array(DifferentialDiagnosisSchema).min(3).max(7),
  reasoning_summary: z.string().min(1),
  red_flags: z.array(z.string()),
});

export type DifferentialDiagnosis = z.infer<typeof DifferentialDiagnosisSchema>;
export type DifferentialOutput = z.infer<typeof DifferentialOutputSchema>;

// ---------------------------------------------------------------------
// Devil's Advocate — adversarial critique of the Differential output.
// ---------------------------------------------------------------------

export const DevilsAdvocateCritiqueSchema = z.object({
  type: z.enum([
    'anchoring_bias',
    'missed_diagnosis',
    'weak_reasoning',
    'ignored_finding',
    'overconfidence',
  ]),
  target_diagnosis: z.string().min(1),
  argument: z.string().min(1),
  alternative_diagnosis: z.string().optional(),
  alternative_icd10_code: z.string().optional(),
  evidence_from_bundle: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high']),
});

export const DevilsAdvocateOutputSchema = z.object({
  critiques: z.array(DevilsAdvocateCritiqueSchema).min(2).max(6),
  overall_assessment: z.enum(['solid', 'needs_revision', 'concerning']),
  assessment_reasoning: z.string().min(1),
  agreed_top_diagnosis: z.string().optional(),
});

export type DevilsAdvocateCritique = z.infer<typeof DevilsAdvocateCritiqueSchema>;
export type DevilsAdvocateOutput = z.infer<typeof DevilsAdvocateOutputSchema>;
