'use client';

import { useActionState, useEffect, useState } from 'react';
import { OCCASION_LABEL } from '@/lib/format';

type Result = {
  ok: boolean;
  error?: string;
  paidDays?: number;
  ptoDays?: number;
  dockedDays?: number;
  notes?: string[];
  days?: number;
};
export type AbsenceFormState = { error?: string; ok?: string };

const TYPES = [
  ['SICK', 'Sick'],
  ['PERSONAL', 'Personal'],
  ['SIMCHA', 'Simcha'],
  ['MATERNITY', 'Maternity'],
  ['SNOW_DAY', 'Snow day'],
  ['UNPAID', 'Unpaid'],
] as const;

/**
 * Shared by "Post an absence" (managers) and "Request time off" (staff). Shows a live preview of
 * what the handbook rules will do, from /api/absences/preview.
 */
export function AbsenceForm({
  action,
  employees,
  fixedEmployeeId,
  submitLabel,
  withNote,
}: {
  action: (prev: AbsenceFormState, fd: FormData) => Promise<AbsenceFormState>;
  employees?: { id: string; name: string }[];
  fixedEmployeeId?: string;
  submitLabel: string;
  withNote?: boolean;
}) {
  const [v, setV] = useState({
    employeeId: fixedEmployeeId ?? '',
    type: 'SICK',
    occasion: '',
    startsOn: '',
    endsOn: '',
    adjacentToVacation: false,
  });
  const [preview, setPreview] = useState<Result | null>(null);
  const [state, formAction, pending] = useActionState<AbsenceFormState, FormData>(async (prev, fd) => {
    const res = await action(prev, fd);
    if (res.ok) {
      setV((p) => ({ ...p, startsOn: '', endsOn: '', occasion: '', adjacentToVacation: false }));
      setPreview(null);
    }
    return res;
  }, {});
  const complete = !!(v.employeeId && v.startsOn && v.endsOn && (v.type !== 'SIMCHA' || v.occasion));
  const shown = complete ? preview : null;
  const set = (k: keyof typeof v) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setV((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? !!e.target.checked : e.target.value }));

  useEffect(() => {
    if (!complete) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch('/api/absences/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, occasion: v.type === 'SIMCHA' ? v.occasion : undefined }),
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then(setPreview)
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [v, complete]);

  return (
    <form action={formAction} className="stack">
      {fixedEmployeeId ? (
        <input type="hidden" name="employeeId" value={fixedEmployeeId} />
      ) : (
        <div className="field">
          <label htmlFor="employeeId">Employee</label>
          <select
            id="employeeId"
            name="employeeId"
            value={v.employeeId}
            onChange={set('employeeId')}
            required
          >
            <option value="">Select employee</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" value={v.type} onChange={set('type')}>
            {TYPES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {v.type === 'SIMCHA' ? (
          <div className="field">
            <label htmlFor="occasion">Occasion</label>
            <select id="occasion" name="occasion" value={v.occasion} onChange={set('occasion')} required>
              <option value="">Choose…</option>
              {Object.entries(OCCASION_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}
        <div className="field">
          <label htmlFor="startsOn">Start date</label>
          <input
            id="startsOn"
            type="date"
            name="startsOn"
            value={v.startsOn}
            onChange={(e) =>
              setV((p) => ({
                ...p,
                startsOn: e.target.value,
                endsOn: p.endsOn && p.endsOn >= e.target.value ? p.endsOn : e.target.value,
              }))
            }
            required
          />
        </div>
        <div className="field">
          <label htmlFor="endsOn">End date</label>
          <input
            id="endsOn"
            type="date"
            name="endsOn"
            value={v.endsOn}
            min={v.startsOn}
            onChange={set('endsOn')}
            required
          />
        </div>
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="adjacentToVacation"
          checked={v.adjacentToVacation}
          onChange={set('adjacentToVacation')}
        />
        Day before or after a vacation / Yom Tov (unpaid days are double-docked)
      </label>
      {withNote && (
        <div className="field">
          <label htmlFor="note">Note (optional)</label>
          <textarea id="note" name="note" maxLength={500} />
        </div>
      )}
      {shown && (
        <div className="preview-box" aria-live="polite">
          {shown.ok ? (
            <>
              <strong>{shown.days} school day(s):</strong> {shown.paidDays} paid · {shown.ptoDays} from PTO ·{' '}
              {shown.dockedDays} docked
              {shown.notes && shown.notes.length > 0 && (
                <ul>
                  {shown.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <span className="error" style={{ margin: 0 }}>
              {shown.error}
            </span>
          )}
        </div>
      )}
      <p className="faint" style={{ margin: 0 }}>
        Sick and personal days come out of PTO. Simcha, maternity and snow days are excused and don&apos;t use
        PTO; only employees eligible under the handbook can receive them.
      </p>
      {state.error && (
        <p className="alert alert-error" role="alert" style={{ margin: 0 }}>
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="alert alert-ok" role="status" style={{ margin: 0 }}>
          {state.ok}
        </p>
      )}
      <div>
        <button className="btn btn-primary" disabled={pending || (shown !== null && !shown.ok)}>
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
