'use client';

import { useActionState, useState } from 'react';
import { benefitRules, ptoAllowanceDays } from '@/lib/rules/benefits';
import type { Employee } from '@/lib/store';
import { createEmployee, sendInvite, updateEmployee, type ActionState } from './actions';

const dollars = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2));

export function EmployeeForm({ employee, departments }: { employee?: Employee; departments: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    employee ? updateEmployee : createEmployee,
    {},
  );
  const [periods, setPeriods] = useState(employee?.periodsPerWeek ?? 0);
  const [years, setYears] = useState(employee?.yearsAtSchool ?? 0);
  const [days, setDays] = useState(employee?.daysPerWeek ?? 5);
  const rules = benefitRules({ periodsPerWeek: periods, yearsAtSchool: years, daysPerWeek: days });
  return (
    <form action={action}>
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" defaultValue={employee?.name} required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={employee?.email} required />
        </div>
        <div className="field">
          <label htmlFor="knownAs">Known as</label>
          <input id="knownAs" name="knownAs" defaultValue={employee?.knownAs ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="department">Department</label>
          <select id="department" name="department" defaultValue={employee?.department ?? ''} required>
            <option value="" disabled>
              Choose…
            </option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="position">Position</label>
          <input id="position" name="position" defaultValue={employee?.position ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="role">Portal access</label>
          <select id="role" name="role" defaultValue={employee?.role ?? 'STAFF'}>
            <option value="STAFF">Staff</option>
            <option value="DEPT_HEAD">Department head (approves time off, schedules their department)</option>
            <option value="ADMIN">Admin (office / HR)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="periodsPerWeek">Periods per week</label>
          <input
            id="periodsPerWeek"
            name="periodsPerWeek"
            type="number"
            min={0}
            max={60}
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="yearsAtSchool">Years at Bnos Menachem</label>
          <input
            id="yearsAtSchool"
            name="yearsAtSchool"
            type="number"
            min={0}
            max={60}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="daysPerWeek">Days per week</label>
          <input
            id="daysPerWeek"
            name="daysPerWeek"
            type="number"
            min={1}
            max={6}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="hiredOn">Hired on</label>
          <input id="hiredOn" name="hiredOn" type="date" defaultValue={employee?.hiredOn ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="hourlyRate">Hourly rate ($) — hourly staff</label>
          <input
            id="hourlyRate"
            name="hourlyRate"
            inputMode="decimal"
            defaultValue={dollars(employee?.hourlyRateCents)}
            placeholder="e.g. 22.00"
          />
        </div>
        <div className="field">
          <label htmlFor="annualSalary">Annual salary ($) — per period / salaried</label>
          <input
            id="annualSalary"
            name="annualSalary"
            inputMode="decimal"
            defaultValue={dollars(employee?.annualSalaryCents)}
            placeholder="e.g. 48000"
          />
        </div>
        <div className="span-2 preview-box">
          {rules ? (
            <>
              <strong>
                {rules.basis === 'HOURLY'
                  ? 'Hourly — paid when present, uses the time clock'
                  : 'Per period / salaried'}
              </strong>
              <ul>
                <li>Tuition &amp; parsonage: {rules.tuitionAndParsonage ? 'Yes' : 'No'}</li>
                <li>
                  PTO:{' '}
                  {rules.pto
                    ? `${ptoAllowanceDays({ periodsPerWeek: periods, yearsAtSchool: years, daysPerWeek: days })} days`
                    : 'No'}
                </li>
                <li>Simcha &amp; maternity: {rules.simchaAndMaternity ? 'Yes' : 'No'}</li>
                <li>
                  Yomtov &amp; vacation:{' '}
                  {rules.yomtovAndVacation === 'PAID'
                    ? 'Paid'
                    : rules.yomtovAndVacation === 'ELIGIBLE'
                      ? 'Eligible'
                      : 'No'}
                </li>
              </ul>
            </>
          ) : (
            'Enter periods per week to see benefit eligibility.'
          )}
        </div>
        <label className="check span-2">
          <input type="checkbox" name="active" defaultChecked={employee?.active ?? true} /> Active (can sign
          in and appears in lists)
        </label>
      </div>
      {state.error && (
        <p className="alert alert-error mt" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="alert alert-ok mt" role="status">
          {state.ok}
        </p>
      )}
      <div className="form-actions">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}
        </button>
      </div>
    </form>
  );
}

export function InviteButton({ id, hasPassword }: { id: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sendInvite, {});
  return (
    <form action={action} className="stack-sm">
      <input type="hidden" name="id" value={id} />
      <div>
        <button className="btn btn-secondary" disabled={pending}>
          {pending ? 'Sending…' : hasPassword ? 'Send password reset link' : 'Send invite'}
        </button>
      </div>
      {state.error && <p className="error">{state.error}</p>}
      {state.ok && <p className="faint">{state.ok}</p>}
      {state.link && (
        <input
          readOnly
          value={state.link}
          onFocus={(e) => e.target.select()}
          className="search-input"
          style={{ width: '100%' }}
          aria-label="Invite link"
        />
      )}
    </form>
  );
}
