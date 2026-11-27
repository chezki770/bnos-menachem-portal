import { NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { getSessionUser } from '@/lib/auth/current-user';
import { planImport, type ImportPlan } from '@/lib/data/csv-io';
import { fillAbsenceResults, importOptions, referencesToRemoved } from '@/lib/data/import-config';
import { sameOrigin } from '@/lib/http';
import { IMPORTABLE, TABLES, type TableName } from '@/lib/store';

type Row = Record<string, unknown> & { id: string };

const MAX_BYTES = 5 * 1024 * 1024;
const fields = z.object({
  table: z.enum(IMPORTABLE as [TableName, ...TableName[]]),
  mode: z.enum(['merge', 'replace']),
  apply: z.enum(['0', '1']),
  confirm: z.string().optional(),
});

/** Validate (apply=0) or import (apply=1) a CSV into one table. Returns a JSON summary with row errors. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const form = await req.formData();
  const parsed = fields.safeParse({
    table: form.get('table'),
    mode: form.get('mode'),
    apply: form.get('apply'),
    confirm: form.get('confirm') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'Choose a table and mode' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: 'Choose a CSV file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is over 5 MB' }, { status: 400 });
  const { table: name, mode, apply } = parsed.data;
  if (apply === '1' && mode === 'replace' && parsed.data.confirm !== 'REPLACE')
    return NextResponse.json({ error: 'Type REPLACE to confirm replacing the whole table' }, { status: 400 });

  const table = TABLES[name];
  const text = await file.text();
  const options = await importOptions(name, user.id, mode);

  /** Everything that decides whether the import is allowed, given the table's current rows. */
  const evaluate = async (existing: Row[]): Promise<ImportPlan> => {
    const plan = planImport(table as never, text, existing, options);
    if (!plan.errors.length && name === 'absences') {
      const err = await fillAbsenceResults(plan.rows);
      if (err) plan.errors.push({ line: 0, message: err });
    }
    if (name === 'employees' && !plan.errors.length && !plan.rows.some((r) => r.role === 'ADMIN' && r.active))
      plan.errors.push({ line: 0, message: 'The import would leave no active admin' });
    if (!plan.errors.length && mode === 'replace') {
      const kept = new Set(plan.rows.map((r) => r.id));
      const removed = existing.filter((r) => !kept.has(r.id));
      for (const message of await referencesToRemoved(name, removed)) plan.errors.push({ line: 0, message });
    }
    return plan;
  };

  let plan: ImportPlan;
  if (apply === '1') {
    // Validate and write under the table's lock, against the rows as they are right now, so a change
    // made by someone else between "Check file" and "Import" is never overwritten by a stale plan.
    plan = await table.mutate(async (rows) => {
      const p = await evaluate(rows as unknown as Row[]);
      if (!p.errors.length) rows.splice(0, rows.length, ...(p.rows as never[]));
      return p;
    });
  } else {
    plan = await evaluate((await table.all()) as unknown as Row[]);
  }

  const summary = {
    inserted: plan.inserted,
    updated: plan.updated,
    unchanged: plan.unchanged,
    removed: plan.removed,
    errors: plan.errors.slice(0, 50),
    errorCount: plan.errors.length,
  };
  if (apply === '1' && !plan.errors.length) {
    await audit(
      user.id,
      'DATA_IMPORTED',
      'Table',
      name,
      `${mode}: +${plan.inserted} ~${plan.updated} -${plan.removed}`,
    );
    return NextResponse.json({ ...summary, applied: true });
  }
  return NextResponse.json({ ...summary, applied: false });
}
