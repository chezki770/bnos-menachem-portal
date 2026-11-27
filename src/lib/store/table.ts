import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { rowSchema, type Col, type Cols, type RowOf } from './columns';
import { decryptText, encryptText } from './crypto';
import { parseCsvRecords, stringifyCsv } from './csv';

export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR ?? 'data');
}

// Survives dev hot reloads, so every request in this process shares the same locks and caches.
const g = globalThis as unknown as {
  __csvLocks?: Map<string, Promise<unknown>>;
  __csvCache?: Map<string, { mtimeMs: number; size: number; rows: unknown[] }>;
};
const locks = (g.__csvLocks ??= new Map());
const cache = (g.__csvCache ??= new Map());

/** Run fn after every earlier writer of the same file has finished. */
async function withLock<R>(file: string, fn: () => Promise<R>): Promise<R> {
  const prev = locks.get(file) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  locks.set(
    file,
    run.catch(() => undefined),
  );
  return run;
}

export class DataFileError extends Error {}

type WithId = { id: string };

/**
 * One CSV file = one table. Reads are cached and re-read when the file changes on disk (so edits
 * made directly to the file show up). Writes take a per-file lock and replace the file atomically.
 * This is safe for a single server process, which is how the portal is deployed.
 */
export class Table<C extends Cols & { id: Col<string> }> {
  readonly schema;
  readonly columns: string[];
  constructor(
    readonly name: string,
    readonly cols: C,
  ) {
    this.schema = rowSchema(cols);
    this.columns = Object.keys(cols);
  }

  get file(): string {
    return path.join(dataDir(), `${this.name}.csv`);
  }

  /** Raw CSV record → typed row. Throws a readable error for bad data. */
  parseRecord(rec: Record<string, string>, line?: number): RowOf<C> {
    const input: Record<string, string> = {};
    for (const [k, c] of Object.entries(this.cols)) {
      const v = (rec[k] ?? '').trim();
      input[k] = c.secret ? decryptText(v) : v;
    }
    const parsed = this.schema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new DataFileError(
        `${this.name}.csv${line ? ` line ${line}` : ''}: column "${String(issue.path[0])}" ${issue.message}`,
      );
    }
    return parsed.data;
  }

  /** Typed row → CSV cells, encrypting secret columns. */
  formatRow(row: RowOf<C>, opts: { encrypt?: boolean } = { encrypt: true }): string[] {
    return this.columns.map((k) => {
      const c = this.cols[k];
      const cell = c.format((row as Record<string, unknown>)[k]);
      return c.secret && opts.encrypt !== false ? encryptText(cell) : cell;
    });
  }

  private async load(): Promise<RowOf<C>[]> {
    let info;
    try {
      info = await stat(this.file);
    } catch {
      return [];
    }
    const hit = cache.get(this.file);
    if (hit && hit.mtimeMs === info.mtimeMs && hit.size === info.size) return hit.rows as RowOf<C>[];
    const { records } = parseCsvRecords(await readFile(this.file, 'utf8'));
    const rows = records.map((r, i) => this.parseRecord(r, i + 2));
    cache.set(this.file, { mtimeMs: info.mtimeMs, size: info.size, rows });
    return rows;
  }

  /** All rows (copies, so callers can't change the cache by accident). */
  async all(): Promise<RowOf<C>[]> {
    return (await this.load()).map((r) => ({ ...r }));
  }

  async where(pred: (r: RowOf<C>) => boolean): Promise<RowOf<C>[]> {
    return (await this.all()).filter(pred);
  }

  async find(pred: (r: RowOf<C>) => boolean): Promise<RowOf<C> | undefined> {
    const r = (await this.load()).find(pred);
    return r && { ...r };
  }

  async get(id: string): Promise<RowOf<C> | undefined> {
    return this.find((r) => (r as WithId).id === id);
  }

  private async save(rows: RowOf<C>[]): Promise<void> {
    await mkdir(dataDir(), { recursive: true });
    const text = stringifyCsv([this.columns, ...rows.map((r) => this.formatRow(r))]);
    const tmp = `${this.file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmp, text, { mode: 0o600 });
    await rename(tmp, this.file);
    const info = await stat(this.file);
    cache.set(this.file, { mtimeMs: info.mtimeMs, size: info.size, rows });
  }

  /**
   * Change the table under the lock. fn gets a fresh, mutable copy of every row and may edit,
   * push or splice. Every row is validated before anything is written.
   */
  async mutate<R>(fn: (rows: RowOf<C>[]) => R | Promise<R>): Promise<R> {
    return withLock(this.file, async () => {
      cache.delete(this.file); // always start from what's on disk
      const rows = await this.all();
      const result = await fn(rows);
      const valid = rows.map((r, i) => this.parseRecord(this.recordOf(r), i + 2));
      await this.save(valid);
      return result;
    });
  }

  private recordOf(row: RowOf<C>): Record<string, string> {
    const cells = this.formatRow(row, { encrypt: false });
    return Object.fromEntries(this.columns.map((k, i) => [k, cells[i]]));
  }

  async insert(row: Omit<RowOf<C>, 'id'> & { id?: string }): Promise<RowOf<C>> {
    const full = { ...row, id: row.id ?? randomUUID() } as unknown as RowOf<C>;
    await this.mutate((rows) => {
      rows.push(full);
    });
    return full;
  }

  async update(id: string, patch: Partial<RowOf<C>>): Promise<RowOf<C> | undefined> {
    return this.mutate((rows) => {
      const idx = rows.findIndex((r) => (r as WithId).id === id);
      if (idx < 0) return undefined;
      rows[idx] = { ...rows[idx], ...patch, id } as RowOf<C>;
      return rows[idx];
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.mutate((rows) => {
      const idx = rows.findIndex((r) => (r as WithId).id === id);
      if (idx >= 0) rows.splice(idx, 1);
      return idx >= 0;
    });
  }

  /** Append one row without rewriting the file (for append-only logs). */
  async append(row: Omit<RowOf<C>, 'id'> & { id?: string }): Promise<RowOf<C>> {
    const full = { ...row, id: row.id ?? randomUUID() } as unknown as RowOf<C>;
    const valid = this.parseRecord(this.recordOf(full));
    await withLock(this.file, async () => {
      await mkdir(dataDir(), { recursive: true });
      let exists = true;
      try {
        await stat(this.file);
      } catch {
        exists = false;
      }
      const lines = exists ? [this.formatRow(valid)] : [this.columns, this.formatRow(valid)];
      await appendFile(this.file, stringifyCsv(lines), { mode: 0o600 });
      cache.delete(this.file);
    });
    return valid;
  }

  /** Replace every row (used by CSV import in replace mode). Rows must already be valid. */
  async replaceAll(rows: RowOf<C>[]): Promise<void> {
    await withLock(this.file, () => this.save(rows));
  }
}
