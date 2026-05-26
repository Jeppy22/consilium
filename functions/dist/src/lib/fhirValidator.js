"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFhirBundle = validateFhirBundle;
const schemas_1 = require("./schemas");
function validateFhirBundle(input) {
    const parsed = schemas_1.FhirBundleSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, errors: formatZodErrors(parsed.error) };
    }
    const semanticErrors = checkSemantics(parsed.data);
    if (semanticErrors.length > 0) {
        return { ok: false, errors: semanticErrors };
    }
    return { ok: true, bundle: parsed.data };
}
function formatZodErrors(error) {
    return error.issues.map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : '(root)';
        return `${path}: ${issue.message}`;
    });
}
function checkSemantics(bundle) {
    const errors = [];
    const patients = bundle.entry
        .map((e) => e.resource)
        .filter((r) => r.resourceType === 'Patient');
    if (patients.length === 0) {
        errors.push('Bundle must contain exactly one Patient resource (found 0).');
    }
    else if (patients.length > 1) {
        errors.push(`Bundle must contain exactly one Patient resource (found ${patients.length}).`);
    }
    const patientIds = new Set(patients.map((p) => p.id));
    for (const entry of bundle.entry) {
        const r = entry.resource;
        if (r.resourceType === 'Patient')
            continue;
        const ref = r.subject.reference;
        const match = ref.match(/^Patient\/(.+)$/);
        if (!match) {
            errors.push(`${r.resourceType}/${r.id}: subject.reference must be "Patient/<id>", got "${ref}".`);
            continue;
        }
        if (!patientIds.has(match[1])) {
            errors.push(`${r.resourceType}/${r.id}: subject.reference "Patient/${match[1]}" does not match any Patient in the bundle.`);
        }
    }
    const seen = new Set();
    for (const entry of bundle.entry) {
        const key = `${entry.resource.resourceType}/${entry.resource.id}`;
        if (seen.has(key)) {
            errors.push(`Duplicate resource id: ${key}.`);
        }
        seen.add(key);
    }
    return errors;
}
//# sourceMappingURL=fhirValidator.js.map