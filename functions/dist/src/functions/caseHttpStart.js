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
const crypto_1 = require("crypto");
const df = __importStar(require("durable-functions"));
const functions_1 = require("@azure/functions");
const schemas_1 = require("../lib/schemas");
const cosmos_1 = require("../lib/cosmos");
const durableClientInput = df.input.durableClient();
async function caseHttpStart(request, context) {
    const expected = process.env.CONSILIUM_API_KEY;
    if (!expected) {
        context.error('CONSILIUM_API_KEY is not configured');
        return {
            status: 500,
            jsonBody: { error: 'Server misconfigured: CONSILIUM_API_KEY not set' },
        };
    }
    if (request.headers.get('x-api-key') !== expected) {
        return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }
    let body;
    try {
        body = await request.json();
    }
    catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }
    const parsed = schemas_1.ClinicalInputSchema.safeParse(body);
    if (!parsed.success) {
        return {
            status: 400,
            jsonBody: { error: 'Invalid clinical input', issues: parsed.error.issues },
        };
    }
    const caseId = (0, crypto_1.randomUUID)();
    const createdAt = new Date().toISOString();
    const store = await (0, cosmos_1.getStore)();
    await store.writeCase({ caseId, input: parsed.data, createdAt });
    const client = df.getClient(context);
    const instanceId = await client.startNew('caseOrchestrator', {
        input: { caseId, input: parsed.data },
    });
    context.log(`[caseHttpStart] caseId=${caseId} instanceId=${instanceId}`);
    return {
        status: 202,
        jsonBody: {
            caseId,
            instanceId,
            createdAt,
            statusUrl: `/api/cases/${caseId}/status?instanceId=${instanceId}`,
        },
    };
}
functions_1.app.http('caseHttpStart', {
    route: 'cases',
    methods: ['POST'],
    authLevel: 'anonymous',
    extraInputs: [durableClientInput],
    handler: caseHttpStart,
});
//# sourceMappingURL=caseHttpStart.js.map