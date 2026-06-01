// Dual-mode store: Azure Table Storage when STORAGE_ACCOUNT_NAME is set
// (deployed), local JSON files when not (local dev). Both expose the same
// Store interface so callers don't branch.
//
// Filename kept as cosmos.ts to avoid churning every import site after the
// Cosmos → Table Storage migration. The implementation underneath is Table
// Storage; "Cosmos" remains only in the filename.

import { promises as fs } from 'fs';
import path from 'path';
import {
  TableClient,
  TableServiceClient,
  odata,
  RestError,
} from '@azure/data-tables';
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
// Table-backed store (deployed)
//
// TODO: Table Storage limits each property to 64KB and an entity to 1MB.
// Our largest agent outputs (synthesizer) measure ~12–27KB serialized so
// we're well within bounds. If a future agent's output grows, split it
// across multiple chunked properties or move to Blob with a pointer.
// ---------------------------------------------------------------------

const CASES_TABLE = 'cases';
const TRACES_TABLE = 'traces';

type CaseEntity = {
  partitionKey: string;
  rowKey: string;
  input: string;
  createdAt: string;
};

type TraceEntity = {
  partitionKey: string;
  rowKey: string;
  step: number;
  agent: TraceEntry['agent'];
  status: TraceEntry['status'];
  input?: string;
  output?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
};

class TableStore implements Store {
  constructor(
    private cases: TableClient,
    private traces: TableClient
  ) {}

  static async create(): Promise<TableStore> {
    const account = process.env.STORAGE_ACCOUNT_NAME;
    if (!account) {
      throw new Error('STORAGE_ACCOUNT_NAME must be set for TableStore');
    }

    const endpoint = `https://${account}.table.core.windows.net`;
    const credential = new DefaultAzureCredential();

    const service = new TableServiceClient(endpoint, credential);
    await ensureTable(service, CASES_TABLE);
    await ensureTable(service, TRACES_TABLE);

    const cases = new TableClient(endpoint, CASES_TABLE, credential);
    const traces = new TableClient(endpoint, TRACES_TABLE, credential);
    return new TableStore(cases, traces);
  }

  async writeCase(record: CaseRecord): Promise<void> {
    const entity: CaseEntity = {
      partitionKey: record.caseId,
      rowKey: 'case',
      input: JSON.stringify(record.input),
      createdAt: record.createdAt,
    };
    await this.cases.upsertEntity(entity, 'Replace');
  }

  async writeTrace(entry: TraceEntry): Promise<void> {
    const entity: TraceEntity = {
      partitionKey: entry.caseId,
      rowKey: `${entry.step}-${entry.agent}-${entry.status}`,
      step: entry.step,
      agent: entry.agent,
      status: entry.status,
      startedAt: entry.startedAt,
    };
    if (entry.input !== undefined) entity.input = JSON.stringify(entry.input);
    if (entry.output !== undefined) entity.output = JSON.stringify(entry.output);
    if (entry.error !== undefined) entity.error = entry.error;
    if (entry.completedAt !== undefined) entity.completedAt = entry.completedAt;
    await this.traces.upsertEntity(entity, 'Replace');
  }

  async getCase(caseId: string): Promise<CaseRecord | null> {
    try {
      const e = await this.cases.getEntity<CaseEntity>(caseId, 'case');
      return {
        caseId,
        input: safeParseJson(e.input),
        createdAt: e.createdAt,
      };
    } catch (err) {
      if (err instanceof RestError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async getTraces(caseId: string): Promise<TraceEntry[]> {
    const entries: TraceEntry[] = [];
    const iter = this.traces.listEntities<TraceEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${caseId}` },
    });
    for await (const e of iter) {
      entries.push({
        caseId,
        step: e.step,
        agent: e.agent,
        status: e.status,
        input: e.input !== undefined ? safeParseJson(e.input) : undefined,
        output: e.output !== undefined ? safeParseJson(e.output) : undefined,
        error: e.error,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
      });
    }
    entries.sort((a, b) => {
      if (a.step !== b.step) return a.step - b.step;
      return a.startedAt.localeCompare(b.startedAt);
    });
    return entries;
  }
}

async function ensureTable(service: TableServiceClient, name: string): Promise<void> {
  try {
    await service.createTable(name);
  } catch (err) {
    if (err instanceof RestError && (err.statusCode === 409 || err.code === 'TableAlreadyExists')) {
      return;
    }
    throw err;
  }
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
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

  if (process.env.STORAGE_ACCOUNT_NAME) {
    cachedStore = await TableStore.create();
  } else {
    const localDir =
      process.env.LOCAL_DATA_DIR ?? path.resolve(process.cwd(), '.local-data');
    cachedStore = new FileStore(localDir);
  }

  return cachedStore;
}
