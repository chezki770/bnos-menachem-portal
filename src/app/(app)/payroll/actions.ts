'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, firstError, formObject } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { assertAdmin } from '@/lib/auth/current-user';
import { buildRun } from '@/lib/data/payroll';
import { appUrl, sendEmail } from '@/lib/email';
import { fmtRange, parseMoney, SCHOOL_TZ } from '@/lib/format';
import {
  ADJUSTMENT_KINDS,
  adjustments,
  employees,
  payPeriods,
  payrollLines,
  timeCards,
  timeEntries,
} from '@/lib/store';

const url = (periodId: string, tab: string, extra = '') => `/payroll?period=${periodId}&tab=${tab}${extra}`;

async function draftPeriod(id: string, tab: string) {
  const p = await payPeriods.get(id);
  if (!p) back('/payroll', 'Pay period not found', 'error');
  if (p.status !== 'DRAFT')
    back(url(id, tab), 'This pay period is already submitted. Reopen it to make changes.', 'error');
  return p;
}

export async function decideTimeCard(fd: FormData) {
  const actor = await assertAdmin();
  const parsed = z
    .object({
      payPeriodId: z.string().min(1),
      employeeId: z.string().min(1),
      decision: z.enum(['APPROVED', 'NEEDS_CHANGES']),
      note: z.string().trim().max(300).optional(),
    })
    .safeParse(formObject(fd));
  if (!parsed.success) back('/payroll', firstError(parsed.error), 'error');
  const d = parsed.data;
  const period = await draftPeriod(d.payPeriodId, 'cards');
  if (d.decision === 'NEEDS_CHANGES' && !d.note)
    back(url(period.id, 'cards', `&emp=${d.employeeId}`), 'Say what needs to change', 'error');
  const now = new Date().toISOString();
  await timeCards.mutate((rows) => {
    const card = rows.find((c) => c.employeeId === d.employeeId && c.payPeriodId === period.id);
    const patch = { status: d.decision, decidedById: actor.id, decidedAt: now, note: d.note || null };
    if (card) Object.assign(card, patch);
    else
      rows.push({
        id: crypto.randomUUID(),
        employeeId: d.employeeId,
        payPeriodId: period.id,
        submittedAt: now,
        ...patch,
      });
  });
  await audit(actor.id, `TIME_CARD_${d.decision}`, 'PayPeriod', period.id, d.employeeId);
  if (d.decision === 'NEEDS_CHANGES') {
    const emp = await employees.get(d.employeeId);
    if (emp)
      await sendEmail({
        to: emp.email,
        subject: 'Your time card needs changes',
        text: `The office asked for changes to your time card for ${fmtRange(period.startsOn, period.endsOn)}:\n\n${d.note}\n\n${appUrl('/me/schedule')}`,
      });
  }
  revalidatePath('/payroll');
  back(url(period.id, 'cards'), d.decision === 'APPROVED' ? 'Time card approved' : 'Sent back for changes');
}

export async function approveAllSubmitted(fd: FormData) {
  const actor = await assertAdmin();
  const period = await draftPeriod(z.string().parse(fd.get('payPeriodId')), 'cards');
  const now = new Date().toISOString();
  const n = await timeCards.mutate((rows) => {
    let count = 0;
    for (const c of rows)
      if (c.payPeriodId === period.id && c.status === 'SUBMITTED') {
        Object.assign(c, { status: 'APPROVED', decidedById: actor.id, decidedAt: now });
        count++;
      }
    return count;
  });
  await audit(actor.id, 'TIME_CARDS_APPROVED', 'PayPeriod', period.id, String(n));
  back(url(period.id, 'cards'), `${n} time card(s) approved`);
}

/** Admin adds or fixes a punch. Times are entered in the school's time zone. */
export async function saveTimeEntry(fd: FormData) {
  const actor = await assertAdmin();
  const parsed = z
    .object({
      payPeriodId: z.string().min(1),
      employeeId: z.string().min(1),
      id: z.string().optional(),
      date: z.iso.date(),
      in: z.string().regex(/^\d{2}:\d{2}$/),
      out: z.string().regex(/^\d{2}:\d{2}$/),
      note: z.string().trim().min(1, 'Add a reason for the change').max(200),
    })
    .refine((v) => v.out > v.in, { message: 'Clock out must be after clock in', path: ['out'] })
    .safeParse(formObject(fd));
  const backTo = url(String(fd.get('payPeriodId')), 'cards', `&emp=${String(fd.get('employeeId'))}`);
  if (!parsed.success) back(backTo, firstError(parsed.error), 'error');
  const d = parsed.data;
  await draftPeriod(d.payPeriodId, 'cards');
  const toIso = (time: string) => zonedIso(d.date, time);
  const row = {
    employeeId: d.employeeId,
    clockIn: toIso(d.in),
    clockOut: toIso(d.out),
    source: 'MANUAL' as const,
    note: d.note,
    editedById: actor.id,
  };
  if (d.id) await timeEntries.update(d.id, row);
  else await timeEntries.insert(row);
  await audit(
    actor.id,
    d.id ? 'TIME_ENTRY_EDITED' : 'TIME_ENTRY_ADDED',
    'TimeEntry',
    d.id ?? null,
    `${d.employeeId} ${d.date} ${d.in}-${d.out}: ${d.note}`,
  );
  back(backTo, 'Time entry saved');
}

export async function deleteTimeEntry(fd: FormData) {
  const actor = await assertAdmin();
  const id = z.string().min(1).parse(fd.get('id'));
  const periodId = z.string().parse(fd.get('payPeriodId'));
  const employeeId = z.string().parse(fd.get('employeeId'));
  await draftPeriod(periodId, 'cards');
  await timeEntries.remove(id);
  await audit(actor.id, 'TIME_ENTRY_DELETED', 'TimeEntry', id);
  back(url(periodId, 'cards', `&emp=${employeeId}`), 'Time entry removed');
}

/** "2026-09-08" + "08:00" in the school's time zone → UTC ISO string. */
function zonedIso(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const local = new Date(guess.toLocaleString('en-US', { timeZone: SCHOOL_TZ }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() + (utc.getTime() - local.getTime())).toISOString();
}

export async function addAdjustment(fd: FormData) {
  const actor = await assertAdmin();
  const parsed = z
    .object({
      payPeriodId: z.string().min(1),
      employeeId: z.string().min(1, 'Choose an employee'),
      kind: z.enum(ADJUSTMENT_KINDS),
      amount: z.string(),
      note: z.string().trim().min(1, 'Add a note').max(200),
    })
    .safeParse(formObject(fd));
  if (!parsed.success)
    back(url(String(fd.get('payPeriodId')), 'adjustments'), firstError(parsed.error), 'error');
  const period = await draftPeriod(parsed.data.payPeriodId, 'adjustments');
  const cents = parseMoney(parsed.data.amount);
  if (!cents || cents <= 0) back(url(period.id, 'adjustments'), 'Enter an amount greater than zero', 'error');
  const row = await adjustments.insert({
    payPeriodId: period.id,
    employeeId: parsed.data.employeeId,
    kind: parsed.data.kind,
    cents,
    note: parsed.data.note,
    createdById: actor.id,
    createdAt: new Date().toISOString(),
  });
  await audit(actor.id, 'ADJUSTMENT_ADDED', 'PayPeriod', period.id, `${row.employeeId} ${row.kind} ${cents}`);
  back(url(period.id, 'adjustments'), 'Adjustment added');
}

export async function deleteAdjustment(fd: FormData) {
  const actor = await assertAdmin();
  const id = z.string().min(1).parse(fd.get('id'));
  const a = await adjustments.get(id);
  if (!a) back('/payroll', 'Adjustment not found', 'error');
  await draftPeriod(a.payPeriodId, 'adjustments');
  await adjustments.remove(id);
  await audit(
    actor.id,
    'ADJUSTMENT_DELETED',
    'PayPeriod',
    a.payPeriodId,
    `${a.employeeId} ${a.kind} ${a.cents}`,
  );
  back(url(a.payPeriodId, 'adjustments'), 'Adjustment removed');
}

/** Freeze the run: READY lines are saved to payroll_lines and the period is marked submitted. */
export async function submitRun(fd: FormData) {
  const actor = await assertAdmin();
  const period = await draftPeriod(z.string().parse(fd.get('payPeriodId')), 'run');
  if (fd.get('reviewed') !== 'on')
    back(url(period.id, 'run'), 'Check "I\'ve reviewed this run" first', 'error');
  const lines = (await buildRun(period)).filter((l) => l.status === 'READY');
  if (!lines.length) back(url(period.id, 'run'), 'No employees are ready to be paid', 'error');
  await payrollLines.mutate((rows) => {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].payPeriodId === period.id) rows.splice(i, 1);
    for (const l of lines)
      rows.push({
        id: crypto.randomUUID(),
        payPeriodId: period.id,
        employeeId: l.employee.id,
        basis: l.basis,
        regularHours: l.regularHours,
        overtimeHours: l.overtimeHours,
        dockedDays: l.dockedDays,
        grossCents: l.grossCents,
        dockedCents: l.dockedCents,
        adjustmentsCents: l.adjustmentsCents,
        totalCents: l.totalCents,
      });
  });
  await payPeriods.update(period.id, {
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString(),
    submittedById: actor.id,
  });
  await audit(actor.id, 'PAYROLL_SUBMITTED', 'PayPeriod', period.id, `${lines.length} employees`);
  back(
    url(period.id, 'run'),
    `Submitted ${lines.length} employee(s). Download the CSV for the payroll provider.`,
  );
}

export async function setPeriodStatus(fd: FormData) {
  const actor = await assertAdmin();
  const parsed = z
    .object({ payPeriodId: z.string().min(1), status: z.enum(['DRAFT', 'PAID']) })
    .safeParse(formObject(fd));
  if (!parsed.success) back('/payroll', 'Invalid request', 'error');
  const p = await payPeriods.get(parsed.data.payPeriodId);
  if (!p) back('/payroll', 'Pay period not found', 'error');
  if (parsed.data.status === 'PAID' && p.status !== 'SUBMITTED')
    back(url(p.id, 'run'), 'Submit the run first', 'error');
  if (parsed.data.status === 'DRAFT') {
    if (p.status !== 'SUBMITTED') back(url(p.id, 'run'), 'Only submitted runs can be reopened', 'error');
    await payrollLines.mutate((rows) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].payPeriodId === p.id) rows.splice(i, 1);
    });
  }
  await payPeriods.update(p.id, {
    status: parsed.data.status,
    ...(parsed.data.status === 'DRAFT' ? { submittedAt: null, submittedById: null } : {}),
  });
  await audit(
    actor.id,
    parsed.data.status === 'PAID' ? 'PAYROLL_MARKED_PAID' : 'PAYROLL_REOPENED',
    'PayPeriod',
    p.id,
  );
  back(url(p.id, 'run'), parsed.data.status === 'PAID' ? 'Marked as paid' : 'Run reopened as a draft');
}
