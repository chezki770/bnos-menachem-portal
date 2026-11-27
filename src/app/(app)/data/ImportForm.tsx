'use client';

import { useRef, useState } from 'react';

type Result = {
  error?: string;
  inserted?: number;
  updated?: number;
  unchanged?: number;
  removed?: number;
  errors?: { line: number; message: string }[];
  errorCount?: number;
  applied?: boolean;
};

export function ImportForm({ tables }: { tables: { name: string; label: string }[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  async function run(apply: boolean) {
    if (!form.current) return;
    const fd = new FormData(form.current);
    fd.set('apply', apply ? '1' : '0');
    setBusy(true);
    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const json = (await res.json()) as Result;
      setResult(json);
      setChecked(!apply && !json.error && !json.errorCount);
    } catch {
      setResult({ error: 'Upload failed. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={form}
      className="stack"
      onSubmit={(e) => e.preventDefault()}
      onChange={() => setChecked(false)}
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="table">Table</label>
          <select id="table" name="table" defaultValue="employees">
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mode">Mode</label>
          <select
            id="mode"
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}
          >
            <option value="merge">Merge — add new rows, update matching ones</option>
            <option value="replace">Replace — the file becomes the whole table</option>
          </select>
        </div>
        <div className="field span-2">
          <label htmlFor="file">CSV file</label>
          <input id="file" type="file" name="file" accept=".csv,text/csv" required />
          <div className="hint">
            First row is the column names. Rows match by id (employees also by email). Columns you leave out
            keep their current values. Up to 5 MB.
          </div>
        </div>
        {mode === 'replace' && (
          <div className="field span-2">
            <label htmlFor="confirm">Type REPLACE to confirm — rows not in the file will be deleted</label>
            <input id="confirm" name="confirm" autoComplete="off" />
          </div>
        )}
      </div>
      <div className="hstack">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(false)}>
          {busy ? 'Checking…' : '1. Check file'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !checked}
          onClick={() => run(true)}
          title={checked ? '' : 'Check the file first'}
        >
          2. Import
        </button>
      </div>
      {result && (
        <div
          className={`alert ${result.error || result.errorCount ? 'alert-error' : 'alert-ok'}`}
          role="status"
        >
          {result.error ? (
            result.error
          ) : result.errorCount ? (
            <>
              <strong>{result.errorCount} problem(s) — nothing was imported.</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {result.errors?.map((e, i) => (
                  <li key={i}>
                    {e.line ? `Line ${e.line}: ` : ''}
                    {e.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {result.applied ? 'Imported: ' : 'Looks good. Importing will make these changes: '}
              {result.inserted} new, {result.updated} updated, {result.unchanged} unchanged
              {result.removed ? `, ${result.removed} removed` : ''}.
            </>
          )}
        </div>
      )}
    </form>
  );
}
