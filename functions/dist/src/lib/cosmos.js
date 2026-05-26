"use strict";
// Dual-mode store: Cosmos DB when COSMOS_ENDPOINT is set (deployed), local
// JSON files when not (local dev without the Cosmos emulator). Both expose
// the same Store interface so callers don't branch.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStore = getStore;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const cosmos_1 = require("@azure/cosmos");
const identity_1 = require("@azure/identity");
// ---------------------------------------------------------------------
// Cosmos-backed store (deployed)
// ---------------------------------------------------------------------
class CosmosStore {
    cases;
    traces;
    constructor(cases, traces) {
        this.cases = cases;
        this.traces = traces;
    }
    static async create() {
        const endpoint = process.env.COSMOS_ENDPOINT;
        if (!endpoint)
            throw new Error('COSMOS_ENDPOINT must be set for CosmosStore');
        const dbName = process.env.COSMOS_DATABASE ?? 'consilium';
        const casesName = process.env.COSMOS_CASES_CONTAINER ?? 'cases';
        const tracesName = process.env.COSMOS_TRACES_CONTAINER ?? 'traces';
        const credential = new identity_1.DefaultAzureCredential();
        const client = new cosmos_1.CosmosClient({ endpoint, aadCredentials: credential });
        const db = client.database(dbName);
        return new CosmosStore(db.container(casesName), db.container(tracesName));
    }
    async writeCase(record) {
        await this.cases.items.upsert({ id: record.caseId, ...record });
    }
    async writeTrace(entry) {
        const id = `${entry.caseId}-${entry.step}-${entry.agent}-${entry.status}`;
        await this.traces.items.upsert({ id, ...entry });
    }
    async getCase(caseId) {
        try {
            const { resource } = await this.cases.item(caseId, caseId).read();
            return resource ?? null;
        }
        catch {
            return null;
        }
    }
    async getTraces(caseId) {
        const { resources } = await this.traces.items
            .query({
            query: 'SELECT * FROM c WHERE c.caseId = @cid ORDER BY c.step, c.startedAt',
            parameters: [{ name: '@cid', value: caseId }],
        }, { partitionKey: caseId })
            .fetchAll();
        return resources;
    }
}
// ---------------------------------------------------------------------
// File-backed store (local dev fallback)
// ---------------------------------------------------------------------
class FileStore {
    dir;
    constructor(dir) {
        this.dir = dir;
    }
    casePath(caseId) {
        return path_1.default.join(this.dir, `${caseId}.json`);
    }
    async readFile(caseId) {
        try {
            const buf = await fs_1.promises.readFile(this.casePath(caseId), 'utf-8');
            return JSON.parse(buf);
        }
        catch {
            return { traces: [] };
        }
    }
    async writeFileContents(caseId, data) {
        await fs_1.promises.mkdir(this.dir, { recursive: true });
        await fs_1.promises.writeFile(this.casePath(caseId), JSON.stringify(data, null, 2), 'utf-8');
    }
    async writeCase(record) {
        const data = await this.readFile(record.caseId);
        data.case = record;
        await this.writeFileContents(record.caseId, data);
    }
    async writeTrace(entry) {
        const data = await this.readFile(entry.caseId);
        data.traces.push(entry);
        await this.writeFileContents(entry.caseId, data);
    }
    async getCase(caseId) {
        const data = await this.readFile(caseId);
        return data.case ?? null;
    }
    async getTraces(caseId) {
        const data = await this.readFile(caseId);
        return data.traces;
    }
}
// ---------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------
let cachedStore = null;
async function getStore() {
    if (cachedStore)
        return cachedStore;
    if (process.env.COSMOS_ENDPOINT) {
        cachedStore = await CosmosStore.create();
    }
    else {
        const localDir = process.env.LOCAL_DATA_DIR ?? path_1.default.resolve(process.cwd(), '.local-data');
        cachedStore = new FileStore(localDir);
    }
    return cachedStore;
}
//# sourceMappingURL=cosmos.js.map