"use strict";
// =====================================================================
// Consilium schemas — functions/ copy.
//
// IMPORTANT: This file is intentionally duplicated in frontend/src/lib/schemas.ts.
// When you change one, change the other. We do NOT share via a file:../shared
// package — that broke on Windows in a prior attempt. Schemas are small and
// stable; duplication is the cure.
// =====================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.FhirBundleSchema = exports.BundleEntrySchema = exports.FhirResourceSchema = exports.MedicationStatementSchema = exports.ObservationSchema = exports.ConditionSchema = exports.PatientSchema = exports.ClinicalInputSchema = exports.VitalSignsSchema = void 0;
const zod_1 = require("zod");
// ---------------------------------------------------------------------
// ClinicalInput — the structured payload the frontend submits
// ---------------------------------------------------------------------
exports.VitalSignsSchema = zod_1.z.object({
    bp: zod_1.z.string().optional(),
    hr: zod_1.z.number().int().min(0).max(400).optional(),
    temp: zod_1.z.number().min(20).max(45).optional(),
    rr: zod_1.z.number().int().min(0).max(80).optional(),
    spo2: zod_1.z.number().int().min(0).max(100).optional(),
});
exports.ClinicalInputSchema = zod_1.z.object({
    age: zod_1.z.number().int().min(0).max(150),
    sex: zod_1.z.enum(['male', 'female', 'other', 'unknown']),
    chief_complaint: zod_1.z.string().min(1),
    duration: zod_1.z.string().min(1),
    current_medications: zod_1.z.array(zod_1.z.string()),
    allergies: zod_1.z.array(zod_1.z.string()),
    past_medical_history: zod_1.z.array(zod_1.z.string()),
    vital_signs: exports.VitalSignsSchema,
    free_text: zod_1.z.string(),
});
// ---------------------------------------------------------------------
// FHIR-shaped Bundle — permissive Consilium subset of FHIR R4.
// Required fields only; no enforced terminology bindings.
// ---------------------------------------------------------------------
const SubjectRefSchema = zod_1.z.object({
    reference: zod_1.z.string().min(1),
});
const CodingSchema = zod_1.z.object({
    system: zod_1.z.string().optional(),
    code: zod_1.z.string().optional(),
    display: zod_1.z.string().optional(),
});
const CodeableConceptSchema = zod_1.z.object({
    text: zod_1.z.string().min(1),
    coding: zod_1.z.array(CodingSchema).optional(),
});
const QuantitySchema = zod_1.z.object({
    value: zod_1.z.number(),
    unit: zod_1.z.string().optional(),
});
exports.PatientSchema = zod_1.z.object({
    resourceType: zod_1.z.literal('Patient'),
    id: zod_1.z.string().min(1),
    gender: zod_1.z.enum(['male', 'female', 'other', 'unknown']).optional(),
    birthDate: zod_1.z.string().optional(),
});
exports.ConditionSchema = zod_1.z.object({
    resourceType: zod_1.z.literal('Condition'),
    id: zod_1.z.string().min(1),
    subject: SubjectRefSchema,
    code: CodeableConceptSchema,
    clinicalStatus: zod_1.z
        .object({
        coding: zod_1.z.array(CodingSchema).optional(),
        text: zod_1.z.string().optional(),
    })
        .optional(),
    recordedDate: zod_1.z.string().optional(),
});
exports.ObservationSchema = zod_1.z.object({
    resourceType: zod_1.z.literal('Observation'),
    id: zod_1.z.string().min(1),
    status: zod_1.z.enum(['registered', 'preliminary', 'final', 'amended', 'corrected']),
    subject: SubjectRefSchema,
    code: CodeableConceptSchema,
    valueQuantity: QuantitySchema.optional(),
    valueString: zod_1.z.string().optional(),
    valueCodeableConcept: CodeableConceptSchema.optional(),
    effectiveDateTime: zod_1.z.string().optional(),
});
exports.MedicationStatementSchema = zod_1.z.object({
    resourceType: zod_1.z.literal('MedicationStatement'),
    id: zod_1.z.string().min(1),
    status: zod_1.z.enum([
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
exports.FhirResourceSchema = zod_1.z.discriminatedUnion('resourceType', [
    exports.PatientSchema,
    exports.ConditionSchema,
    exports.ObservationSchema,
    exports.MedicationStatementSchema,
]);
exports.BundleEntrySchema = zod_1.z.object({
    fullUrl: zod_1.z.string().optional(),
    resource: exports.FhirResourceSchema,
});
exports.FhirBundleSchema = zod_1.z.object({
    resourceType: zod_1.z.literal('Bundle'),
    type: zod_1.z.literal('collection'),
    entry: zod_1.z.array(exports.BundleEntrySchema),
});
//# sourceMappingURL=schemas.js.map