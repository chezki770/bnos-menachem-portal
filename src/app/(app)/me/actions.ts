'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, firstError, formObject } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { assertUser } from '@/lib/auth/current-user';
import { absenceInput } from '@/lib/data/absences';
import { isHourly } from '@/lib/data/employees';
import { withPeriodLock } from '@/lib/data/payroll';
import { openEntry, timeCardSummary } from '@/lib/data/time';
import { appUrl, sendEmail } from '@/lib/email';
import { selfInfoForm } from '@/lib/forms/employee';
import { ABSENCE_LABEL, fmtRange, todayIso } from '@/lib/format';
import { employees, payPeriods, timeCards, timeEntries, timeOffRequests } from '@/lib/store';

export type State = { error?: string; ok?: string };

/** Staff update their own personal details. Blank sensitive fields keep their current value. HR is notified. */
export async function updateMyInfo(_prev: State, fd: FormData): Promise<State> {
  const user = await assertUser();
  const parsed = selfInfoForm.safeParse(formObject(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const changed: string[] = [];
  await employees.mutate((rows) => {
    const e = rows.find((r) => r.id === user.id);
    if (!e) return;
    const setIf = <K extends keyof typeof e>(k: K, v: (typeof e)[K] | undefined, keepIfBlank = false) => {
      if (v === undefined || (keepIfBlank && (v === '' || v === null))) return;
      const next = (v === '' ? null : v) as (typeof e)[K];
      if (e[k] !== next) {
        e[k] = next;
        changed.push(String(k));
      }
    };
    setIf('knownAs', d.knownAs);
    setIf('gender', d.gender);
    setIf('emergencyName', d.emergencyName);
    setIf('emergencyRelationship', d.emergencyRelationship);
    setIf('dateOfBirth', d.dateOfBirth, true);
    setIf('cellPhone', d.cellPhone, true);
    setIf('address', d.address, true);
    setIf('emergencyPhone', d.emergencyPhone, true);
    if (changed.length) e.updatedAt = new Date().toISOString();
  });
  if (!changed.length) return { ok: 'No changes to save' };
  await audit(user.id, 'SELF_INFO_UPDATED', 'Employee', user.id, changed.join(','));
  const admins = await employees.where((e) => e.role === 'ADMIN' && e.active);
  await Promise.all(
    admins.map((a) =>
      sendEmail({
        to: a.email,
        subject: `${user.name} updated their details`,
        text: `${user.name} changed: ${changed.join(', ')}.\n\n${appUrl(`/employees/${user.id}`)}`,
      }),
    ),
  );
  revalidatePath('/me/info');
  return { ok: 'Saved — the office has been notified' };
}

const requestForm = absenceInput.and(z.object({ note: z.string().trim().max(500).optional() }));

export async function requestTimeOff(_prev: State, fd: FormData): Promise<State> {
  const user = await assertUser();
  const parsed = requestForm.safeParse({ ...formObject(fd, ['adjacentToVacation']), employeeId: user.id });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.startsOn < todayIso())
    return { error: 'Requests are for upcoming days. Ask the office to post past absences.' };
  const clash = await timeOffRequests.find(
    (r) =>
      r.employeeId === user.id && r.status === 'PENDING' && r.startsOn <= d.endsOn && d.startsOn <= r.endsOn,
  );
  if (clash) return { error: 'You already have a pending request for those dates' };
  const row = await timeOffRequests.insert({
    employeeId: user.id,
    type: d.type,
    occasion: d.type === 'SIMCHA' ? (d.occasion ?? null) : null,
    startsOn: d.startsOn,
    endsOn: d.endsOn,
    adjacentToVacation: d.adjacentToVacation,
    note: d.note || null,
    status: 'PENDING',
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: new Date().toISOString(),
  });
  await audit(user.id, 'REQUEST_SUBMITTED', 'TimeOffRequest', row.id);
  const approvers = await employees.where(
    (e) =>
      e.active &&
      e.id !== user.id &&
      (e.role === 'ADMIN' || (e.role === 'DEPT_HEAD' && e.department === user.department)),
  );
  await Promise.all(
    approvers.map((a) =>
      sendEmail({
        to: a.email,
        subject: `Time-off request: ${user.name}, ${fmtRange(d.startsOn, d.endsOn)}`,
        text: `${user.name} requested ${ABSENCE_LABEL[d.type].toLowerCase()} time off for ${fmtRange(d.startsOn, d.endsOn)}.${d.note ? `\n\nNote: ${d.note}` : ''}\n\nReview it: ${appUrl('/absences')}`,
      }),
    ),
  );
  revalidatePath('/me/time-off');
  return { ok: 'Request sent for approval' };
}

export async function cancelRequest(fd: FormData) {
  const user = await assertUser();
  const id = z.string().min(1).parse(fd.get('id'));
  const ok = await timeOffRequests.mutate((rows) => {
    const r = rows.find((x) => x.id === id && x.employeeId === user.id && x.status === 'PENDING');
    if (r) r.status = 'CANCELLED';
    return !!r;
  });
  if (!ok) back('/me/time-off', 'That request can no longer be cancelled', 'error');
  await audit(user.id, 'REQUEST_CANCELLED', 'TimeOffRequest', id);
  back('/me/time-off', 'Request cancelled');
}

/** Time clock (hourly staff). */
export async function clockIn() {
  const user = await assertUser();
  const emp = await employees.get(user.id);
  if (!emp || !isHourly(emp)) back('/me/schedule', 'The time clock is for hourly staff', 'error');
  // Check and insert under the time_entries lock, so two taps (or two devices) can't open two punches.
  const id = await timeEntries.mutate((rows) => {
    if (rows.some((e) => e.employeeId === user.id && !e.clockOut)) return null;
    const newId = crypto.randomUUID();
    rows.push({
      id: newId,
      employeeId: user.id,
      clockIn: new Date().toISOString(),
      clockOut: null,
      source: 'CLOCK',
      note: null,
      editedById: null,
    });
    return newId;
  });
  if (!id) back('/me/schedule', "You're already clocked in", 'error');
  await audit(user.id, 'CLOCK_IN', 'TimeEntry', id);
  back('/me/schedule', 'Clocked in');
}

export async function clockOut() {
  const user = await assertUser();
  const closed = await timeEntries.mutate((rows) => {
    const open = rows.find((e) => e.employeeId === user.id && !e.clockOut);
    if (open) open.clockOut = new Date().toISOString();
    return open?.id ?? null;
  });
  if (!closed) back('/me/schedule', "You're not clocked in", 'error');
  await audit(user.id, 'CLOCK_OUT', 'TimeEntry', closed);
  back('/me/schedule', 'Clocked out');
}

/** Submit (or re-submit) the time card for a pay period. */
export async function submitTimeCard(fd: FormData) {
  const user = await assertUser();
  const periodId = z.string().min(1).parse(fd.get('payPeriodId'));
  // Same per-period lock as the office's payroll actions, so a submit can't race "Submit run".
  return withPeriodLock(periodId, async () => {
    const period = await payPeriods.get(periodId);
    if (!period || period.status !== 'DRAFT') back('/me/schedule', 'That pay period is closed', 'error');
    if (await openEntry(user.id)) back('/me/schedule', 'Clock out before submitting your time card', 'error');
    // An approved card can be re-submitted only if its hours changed since approval.
    const current = await timeCardSummary(user.id, period);
    const res = await timeCards.mutate((rows) => {
      const card = rows.find((c) => c.employeeId === user.id && c.payPeriodId === periodId);
      if (card?.status === 'APPROVED' && current.approvalValid) return 'approved';
      const now = new Date().toISOString();
      if (card)
        Object.assign(card, {
          status: 'SUBMITTED',
          submittedAt: now,
          decidedById: null,
          decidedAt: null,
          approvedRegularHours: null,
          approvedOvertimeHours: null,
        });
      else
        rows.push({
          id: crypto.randomUUID(),
          employeeId: user.id,
          payPeriodId: periodId,
          status: 'SUBMITTED',
          submittedAt: now,
          decidedById: null,
          decidedAt: null,
          note: null,
          approvedRegularHours: null,
          approvedOvertimeHours: null,
        });
      return 'ok';
    });
    if (res === 'approved') back('/me/schedule', 'That time card is already approved', 'error');
    await audit(user.id, 'TIME_CARD_SUBMITTED', 'TimeCard', periodId);
    back(`/me/schedule?period=${periodId}`, 'Time card submitted for approval');
  });
}
