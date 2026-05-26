// Dual-mode store: Cosmos DB when COSMOS_ENDPOINT is set (deployed), local
// JSON files when not (local dev without the Cosmos emulator). Both expose
// the same Store interface so callers don't branch.

import { promises as fs } from 'fs';
import path from 'path';
import { CosmosClient, type Container, type Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

export type CaseRecord = {
  caseId: string;
  input: unknown;
  createdAt: string;
};

export type TraceEntry = {
  caseId: string;
  step: number;
  agent: 'historian' | 'differential' | 'evidence' | 'devilsAdvocate' | 'synthesizer';
  status: 'started' | 'completed' | 'failed';
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
};

export interface Store {
  writeCase(record: CaseRecord): Promise<void>;
  writeTrace(entry: TraceEntry): Promise<void>;
  getCase(caseId: string): Promise<CaseRecord | null>;
  getTraces(caseId: string): Promise<TraceEntry[]>;
}

// ---------------------------------------------------------------------
// Cosmos-backed store (deployed)
// ---------------------------------------------------------------------

class CosmosStore implements Store {
  constructor(private cases: Container, private traces: Container) {}

  static async create(): Promise<CosmosStore> {
    const endpoint = process.env.COSMOS_ENDPOINT;
    if (!endpoint) throw new Error('COSMOS_ENDPOINT must be set for CosmosStore');

    const dbName = process.env.COSMOS_DATABASE ?? 'consilium';
    const casesName = process.env.COSMOS_CASES_CONTAINER ?? 'cases';
    const tracesName = process.env.COSMOS_TRACES_CONTAINER ?? 'traces';

    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ endpoint, aadCredentials: credential });
    const db: Database = client.database(dbName);

    return new CosmosStore(db.container(casesName), db.container(tracesName));
  }

  async writeCase(record: CaseRecord): Promise<void> {
    await this.cases.items.upsert({ id: record.caseId, ...record });
  }

  async writeTrace(entry: TraceEntry): Promise<void> {
    const id = `${entry.caseId}-${entry.step}-${entry.agent}-${entry.status}`;
    await this.traces.items.upsert({ id, ...entry });
  }

  async getCase(caseId: string): Promise<CaseRecord | null> {
    try {
      const { resource } = await this.cases.item(caseId, caseId).read<CaseRecord>();
      return resource ?? null;
    } catch {
      return null;
    }
  }

  async getTraces(caseId: string): Promise<TraceEntry[]> {
    const { resources } = await this.traces.items
      .query<TraceEntry>(
        {
          query: 'SELECT * FROM c WHERE c.caseId = @cid ORDER BY c.step, c.startedAt',
          parameters: [{ name: '@cid', value: caseId }],
        },
        { partitionKey: caseId }
      )
      .fetchAll();
    return resources;
  }
}

// ---------------------------------------------------------------------
// File-backed store (local dev fallback)
// ---------------------------------------------------------------------

class FileStore implements Store {
  constructor(private dir: string) {}

  private casePath(caseId: string) {
    return path.join(this.dir, `${caseId}.json`);
  }

  private async readFile(caseId: string): Promise<{ case?: CaseRecord; traces: TraceEntry[] }> {
    try {
      const buf = await fs.readFile(this.casePath(caseId), 'utf-8');
      return JSON.parse(buf);
    } catch {
      return { traces: [] };
    }
  }

  private async writeFileContents(
    caseId: string,
    data: { case?: CaseRecord; traces: TraceEntry[] }
  ): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.casePath(caseId), JSON.stringify(data, null, 2), 'utf-8');
  }

  async writeCase(record: CaseRecord): Promise<void> {
    const data = await this.readFile(record.caseId);
    data.case = record;
    await this.writeFileContents(record.caseId, data);
  }

  async writeTrace(entry: TraceEntry): Promise<void> {
    const data = await this.readFile(entry.caseId);
    data.traces.push(entry);
    await this.writeFileContents(entry.caseId, data);
  }

  async getCase(caseId: string): Promise<CaseRecord | null> {
    const data = await this.readFile(caseId);
    return data.case ?? null;
  }

  async getTraces(caseId: string): Promise<TraceEntry[]> {
    const data = await this.readFile(caseId);
    return data.traces;
  }
}

// ---------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------

let cachedStore: Store | null = null;

export async function getStore(): Promise<Store> {
  if (cachedStore) return cachedStore;

  if (process.env.COSMOS_ENDPOINT) {
    cachedStore = await CosmosStore.create();
  } else {
    const localDir =
      process.env.LOCAL_DATA_DIR ?? path.resolve(process.cwd(), '.local-data');
    cachedStore = new FileStore(localDir);
  }

  return cachedStore;
}
