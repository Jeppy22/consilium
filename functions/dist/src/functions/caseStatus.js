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
const functions_1 = require("@azure/functions");
const cosmos_1 = require("../lib/cosmos");
const durableClientInput = df.input.durableClient();
async function caseStatus(request, context) {
    const expected = process.env.CONSILIUM_API_KEY;
    if (!expected) {
        return { status: 500, jsonBody: { error: 'Server misconfigured' } };
    }
    if (request.headers.get('x-api-key') !== expected) {
        return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }
    const caseId = request.params.caseId;
    const instanceId = request.query.get('instanceId');
    if (!caseId) {
        return { status: 400, jsonBody: { error: 'Missing caseId path parameter' } };
    }
    if (!instanceId) {
        return { status: 400, jsonBody: { error: 'Missing instanceId query parameter' } };
    }
    const client = df.getClient(context);
    const status = await client.getStatus(instanceId, {
        showInput: false,
        showHistory: false,
    });
    const store = await (0, cosmos_1.getStore)();
    const traces = await store.getTraces(caseId);
    context.log(`[caseStatus] caseId=${caseId} runtimeStatus=${status?.runtimeStatus}`);
    return {
        status: 200,
        jsonBody: {
            caseId,
            instanceId,
            runtimeStatus: status?.runtimeStatus ?? 'Unknown',
            createdTime: status?.createdTime,
            lastUpdatedTime: status?.lastUpdatedTime,
            output: status?.output,
            traces,
        },
    };
}
functions_1.app.http('caseStatus', {
    route: 'cases/{caseId}/status',
    methods: ['GET'],
    authLevel: 'anonymous',
    extraInputs: [durableClientInput],
    handler: caseStatus,
});
//# sourceMappingURL=caseStatus.js.map