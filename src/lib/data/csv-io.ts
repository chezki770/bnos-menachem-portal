import { randomUUID } from 'node:crypto';
import type { Cols, RowOf } from '@/lib/store/columns';
import { fromSpreadsheet, parseCsvRecords, spreadsheetSafe, stringifyCsv } from '@/lib/store/csv';
import { DataFileError, type Table } from '@/lib/store/table';
import type { Col } from '@/lib/store/columns';

type AnyTable = Table<Cols & { id: Col<string> }>;
type Row = Record<string, unknown> & { id: string };

/** Columns a person may see in an export: never internal ones, secret ones only on request. */
export function exportColumns(t: AnyTable, includeSensitive: boolean): string[] {
  return t.columns.filter((k) => !t.cols[k].internal && (includeSensitive || !t.cols[k].secret));
}

export function exportCsv(t: AnyTable, rows: RowOf<AnyTable['cols']>[], includeSensitive: boolean): string {
  const cols = exportColumns(t, includeSensitive);
  const idx = cols.map((c) => t.columns.indexOf(c));
  const body = rows.map((r) => {
    const cells = t.formatRow(r, { encrypt: false });
    return idx.map((i) => spreadsheetSafe(cells[i]));
  });
  return stringifyCsv([cols, ...body]);
}

export type ImportIssue = { line: number; message: string };
export type ImportPlan = {
  rows: Row[];
  inserted: number;
  updated: number;
  unchanged: number;
  removed: number;
  errors: ImportIssue[];
};

export type ImportOptions = {
  mode: 'merge' | 'replace';
  /** Values for columns the file leaves out on new rows (e.g. createdAt, createdById). */
  defaults?: Record<string, string>;
  /** Column used to match rows when the file has no id (employees: email). */
  matchBy?: string;
  /** Extra per-row checks (foreign keys, uniqueness). Return an error message or null. */
  check?: (row: Row, all: Row[]) => string | null;
};

/**
 * Work out what importing a CSV would do, without writing anything. Every row is validated with the
 * table's schema. In merge mode rows are matched by id (or matchBy) and only the columns present in the
 * file change; in replace mode the file becomes the whole table (internal columns such as password
 * hashes are carried over for matching rows).
 */
export function planImport(t: AnyTable, text: string, existing: Row[], opts: ImportOptions): ImportPlan {
  const errors: ImportIssue[] = [];
  let parsed;
  try {
    parsed = parseCsvRecords(text);
  } catch (e) {
    return {
      rows: existing,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      errors: [{ line: 0, message: (e as Error).message }],
    };
  }
  const { header, records } = parsed;
  const allowed = new Set(t.columns.filter((k) => !t.cols[k].internal));
  const unknown = header.filter((h) => h && !allowed.has(h));
  if (unknown.length)
    errors.push({
      line: 1,
      message: `Unknown column(s): ${unknown.join(', ')}. Expected: ${[...allowed].join(', ')}`,
    });
  if (header.length === 0 || header.every((h) => !h))
    errors.push({ line: 1, message: 'The file has no header row' });
  if (errors.length) return { rows: existing, inserted: 0, updated: 0, unchanged: 0, removed: 0, errors };

  const byId = new Map(existing.map((r) => [r.id, r]));
  const match = opts.matchBy;
  const byKey = match ? new Map(existing.map((r) => [String(r[match]).toLowerCase(), r])) : null;
  const out: Row[] = opts.mode === 'merge' ? existing.map((r) => ({ ...r })) : [];
  const outIndex = new Map(out.map((r, i) => [r.id, i]));
  const seen = new Set<string>();
  const lineById = new Map<string, number>();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  records.forEach((raw, i) => {
    const line = i + 2;
    const rec: Record<string, string> = {};
    for (const h of header) if (h) rec[h] = fromSpreadsheet(raw[h] ?? '').trim();
    const prior =
      (rec.id && byId.get(rec.id)) ||
      (byKey && match && rec[match] ? byKey.get(rec[match].toLowerCase()) : undefined);
    const id = prior?.id ?? (rec.id || randomUUID());
    if (seen.has(id)) return errors.push({ line, message: `Duplicate row for id ${id}` });
    seen.add(id);
    lineById.set(id, line);

    const base: Record<string, string> = prior
      ? Object.fromEntries(
          t.columns.map((k, idx) => [k, t.formatRow(prior as never, { encrypt: false })[idx]]),
        )
      : { ...(opts.defaults ?? {}) };
    const merged = { ...base, ...rec, id };
    let row: Row;
    try {
      row = t.parseRecord(merged, line) as Row;
    } catch (e) {
      return errors.push({
        line,
        message: e instanceof DataFileError ? e.message.replace(/^[\w.]+ line \d+: /, '') : String(e),
      });
    }
    if (prior) {
      // Internal columns (password hashes) are never imported; keep what's there.
      for (const k of t.columns) if (t.cols[k].internal) row[k] = prior[k];
    }
    const changed = !prior || JSON.stringify(prior) !== JSON.stringify(row);
    if (!prior) inserted++;
    else if (changed) updated++;
    else unchanged++;

    if (opts.mode === 'merge' && outIndex.has(id)) out[outIndex.get(id)!] = row;
    else {
      outIndex.set(id, out.length);
      out.push(row);
    }
  });

  if (opts.check) {
    for (const r of out) {
      if (!seen.has(r.id)) continue; // only check rows from the file
      const msg = opts.check(r, out);
      if (msg) errors.push({ line: lineById.get(r.id) ?? 0, message: msg });
    }
  }
  const removed = opts.mode === 'replace' ? existing.filter((r) => !seen.has(r.id)).length : 0;
  return {
    rows: errors.length ? existing : out,
    inserted,
    updated,
    unchanged,
    removed,
    errors: errors.sort((a, b) => a.line - b.line),
  };
}
