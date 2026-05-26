"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const df = __importStar(require("durable-functions"));
const anthropic_1 = require("../lib/anthropic");
const fhirValidator_1 = require("../lib/fhirValidator");
const historian_1 = require("../prompts/historian");
const schemas_1 = require("../lib/schemas");
const cosmos_1 = require("../lib/cosmos");
const MAX_RETRIES = 3;
df.app.activity('historian', {
    handler: async (raw, context) => {
        const startedAt = new Date().toISOString();
        const input = raw;
        const store = await (0, cosmos_1.getStore)();
        const trace = {
            caseId: input.caseId,
            step: 1,
            agent: 'historian',
            status: 'started',
            input: input.input,
            startedAt,
        };
        await store.writeTrace(trace);
        try {
            const validated = schemas_1.ClinicalInputSchema.parse(input.input);
            const result = await runHistorian(validated, context);
            await store.writeTrace({
                ...trace,
                status: 'completed',
                output: result,
                completedAt: new Date().toISOString(),
            });
            return result;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await store.writeTrace({
                ...trace,
                status: 'failed',
                error: message,
                completedAt: new Date().toISOString(),
            });
            throw err;
        }
    },
});
async function runHistorian(input, context) {
    const client = (0, anthropic_1.getAnthropicClient)();
    const userMessage = buildUserMessage(input);
    const messages = [{ role: 'user', content: userMessage }];
    const validationErrors = [];
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        context.log(`[historian] attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
        const response = await client.messages.create({
            model: anthropic_1.CLAUDE_MODEL,
            max_tokens: 8192,
            system: [
                {
                    type: 'text',
                    text: historian_1.HISTORIAN_SYSTEM_PROMPT,
                    cache_control: { type: 'ephemeral' },
                },
            ],
            tools: [historian_1.VALIDATE_FHIR_BUNDLE_TOOL],
            messages,
        });
        const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'validate_fhir_bundle');
        if (!toolUse) {
            const text = response.content.find((b) => b.type === 'text');
            const preview = text && 'text' in text ? text.text.slice(0, 200) : '(no text content)';
            const errMsg = `Historian did not call validate_fhir_bundle. Model said: ${preview}`;
            validationErrors.push([errMsg]);
            if (attempt >= MAX_RETRIES) {
                throw new Error(`Historian failed after ${MAX_RETRIES + 1} attempts: ${errMsg}`);
            }
            messages.push({ role: 'assistant', content: response.content });
            messages.push({
                role: 'user',
                content: 'You must call the validate_fhir_bundle tool with your proposed bundle. ' +
                    'Do not respond with text — call the tool.',
            });
            continue;
        }
        const proposed = toolUse.input.bundle;
        const result = (0, fhirValidator_1.validateFhirBundle)(proposed);
        if (result.ok) {
            return { bundle: result.bundle, attempts: attempt + 1, validationErrors };
        }
        validationErrors.push(result.errors);
        if (attempt >= MAX_RETRIES) {
            throw new Error(`Historian validation failed after ${MAX_RETRIES + 1} attempts. Final errors:\n` +
                result.errors.join('\n'));
        }
        messages.push({ role: 'assistant', content: response.content });
        messages.push({
            role: 'user',
            content: [
                {
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: `Validation failed with these errors:\n${result.errors.join('\n')}\n\n` +
                        'Call validate_fhir_bundle again with a corrected bundle that addresses every error above.',
                    is_error: true,
                },
            ],
        });
    }
    throw new Error('Historian loop exited unexpectedly');
}
function buildUserMessage(input) {
    const lines = [];
    lines.push('# Clinical case', '');
    lines.push(`**Demographics:** ${input.age} year old ${input.sex}`);
    lines.push(`**Chief complaint:** ${input.chief_complaint}`);
    lines.push(`**Duration:** ${input.duration}`);
    lines.push('', '**Vital signs:**');
    const vs = input.vital_signs;
    const vsLines = [];
    if (vs.bp)
        vsLines.push(`- BP: ${vs.bp}`);
    if (vs.hr !== undefined)
        vsLines.push(`- HR: ${vs.hr} bpm`);
    if (vs.temp !== undefined)
        vsLines.push(`- Temp: ${vs.temp} C`);
    if (vs.rr !== undefined)
        vsLines.push(`- RR: ${vs.rr} /min`);
    if (vs.spo2 !== undefined)
        vsLines.push(`- SpO2: ${vs.spo2}%`);
    lines.push(vsLines.length ? vsLines.join('\n') : '(none provided)');
    lines.push('');
    lines.push(`**Current medications:** ${input.current_medications.length ? input.current_medications.join(', ') : '(none)'}`);
    lines.push(`**Allergies:** ${input.allergies.length ? input.allergies.join(', ') : '(none known)'}`);
    lines.push(`**Past medical history:** ${input.past_medical_history.length ? input.past_medical_history.join(', ') : '(none)'}`);
    lines.push('', '**Narrative / exam findings:**');
    lines.push(input.free_text || '(none)');
    lines.push('', 'Produce a FHIR Bundle by calling validate_fhir_bundle.');
    return lines.join('\n');
}
//# sourceMappingURL=historian.js.map