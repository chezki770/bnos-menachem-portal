'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, firstError, formObject, safePath } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { assertManager, type SessionUser } from '@/lib/auth/current-user';
import { weekDays } from '@/lib/data/shifts';
import { appUrl, sendEmail } from '@/lib/email';
import { fmtDate, fmtTime } from '@/lib/format';
import { absences, employees, shifts, shiftTemplates, type Shift } from '@/lib/store';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 08:00');
const shiftForm = z
  .object({
    id: z.string().optional(),
    date: z.iso.date(),
    startTime: time,
    endTime: time,
    department: z.string().trim().min(1, 'Choose a department'),
    employeeId: z
      .string()
      .optional()
      .transform((v) => v || null),
    reason: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => v || null),
    returnTo: z.string().optional(),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

function canEditDept(user: SessionUser, dept: string) {
  return user.role === 'ADMIN' || dept === user.department;
}

/** Why this employee can't take the shift, or null. */
async function conflict(
  s: Pick<Shift, 'id' | 'date' | 'startTime' | 'endTime' | 'employeeId'>,
): Promise<string | null> {
  if (!s.employeeId) return null;
  const emp = await employees.get(s.employeeId);
  if (!emp || !emp.active) return 'That employee is not active';
  const overlap = await shifts.find(
    (x) =>
      x.id !== s.id &&
      x.employeeId === s.employeeId &&
      x.date === s.date &&
      x.startTime < s.endTime &&
      s.startTime < x.endTime,
  );
  if (overlap)
    return `${emp.name} already has a shift then (${fmtTime(overlap.startTime)}–${fmtTime(overlap.endTime)})`;
  const off = await absences.find(
    (a) => a.employeeId === s.employeeId && a.startsOn <= s.date && s.date <= a.endsOn,
  );
  if (off) return `${emp.name} is off that day`;
  return null;
}

async function notifyAssigned(s: Shift) {
  if (!s.employeeId) return;
  const emp = await employees.get(s.employeeId);
  if (emp)
    await sendEmail({
      to: emp.email,
      subject: `New shift: ${fmtDate(s.date)} ${fmtTime(s.startTime)}`,
      text: `You've been scheduled ${fmtDate(s.date)}, ${fmtTime(s.startTime)}–${fmtTime(s.endTime)} (${s.department}).\n\n${appUrl('/me/schedule')}`,
    });
}

export async function saveShift(fd: FormData) {
  const user = await assertManager();
  const parsed = shiftForm.safeParse(formObject(fd));
  const returnTo = safePath(fd.get('returnTo'), '/scheduling');
  if (!parsed.success) back(returnTo, firstError(parsed.error), 'error');
  const { id, returnTo: _r, ...data } = parsed.data;
  void _r;
  if (!canEditDept(user, data.department))
    back(returnTo, 'You can only schedule your own department', 'error');
  if (id) {
    const existing = await shifts.get(id);
    if (!existing || !canEditDept(user, existing.department)) back(returnTo, 'Shift not found', 'error');
  }
  const why = await conflict({ id: id ?? '', ...data });
  if (why) back(returnTo, why, 'error');
  const before = id ? await shifts.get(id) : undefined;
  const saved = id ? await shifts.update(id, data) : await shifts.insert({ ...data, createdById: user.id });
  await audit(
    user.id,
    id ? 'SHIFT_UPDATED' : 'SHIFT_CREATED',
    'Shift',
    saved!.id,
    `${data.department} ${data.date} ${data.startTime}`,
  );
  if (saved && saved.employeeId && saved.employeeId !== before?.employeeId) await notifyAssigned(saved);
  revalidatePath('/scheduling');
  back(returnTo.replace(/[?&]edit=[^&]*/, ''), id ? 'Shift updated' : 'Shift added');
}

export async function fillShift(fd: FormData) {
  const user = await assertManager();
  const parsed = z
    .object({ id: z.string().min(1), employeeId: z.string().min(1, 'Choose someone') })
    .safeParse(formObject(fd));
  const returnTo = safePath(fd.get('returnTo'), '/scheduling?tab=open');
  if (!parsed.success) back(returnTo, firstError(parsed.error), 'error');
  const s = await shifts.get(parsed.data.id);
  if (!s || !canEditDept(user, s.department)) back(returnTo, 'Shift not found', 'error');
  const why = await conflict({ ...s, employeeId: parsed.data.employeeId });
  if (why) back(returnTo, why, 'error');
  const saved = await shifts.update(s.id, { employeeId: parsed.data.employeeId, reason: null });
  await audit(user.id, 'SHIFT_FILLED', 'Shift', s.id);
  if (saved) await notifyAssigned(saved);
  back(returnTo, 'Shift filled');
}

export async function deleteShift(fd: FormData) {
  const user = await assertManager();
  const id = z.string().min(1).parse(fd.get('id'));
  const returnTo = safePath(fd.get('returnTo'), '/scheduling');
  const s = await shifts.get(id);
  if (!s || !canEditDept(user, s.department)) back(returnTo, 'Shift not found', 'error');
  await shifts.remove(id);
  await audit(user.id, 'SHIFT_DELETED', 'Shift', id, `${s.department} ${s.date}`);
  back(returnTo.replace(/[?&]edit=[^&]*/, ''), 'Shift removed');
}

/** Save the week's shifts (that the user may edit) as a named weekly pattern. */
export async function saveTemplate(fd: FormData) {
  const user = await assertManager();
  const parsed = z
    .object({ name: z.string().trim().min(1, 'Name the template').max(80), week: z.iso.date() })
    .safeParse(formObject(fd));
  if (!parsed.success) back('/scheduling?tab=templates', firstError(parsed.error), 'error');
  const days = weekDays(parsed.data.week);
  const week = (await shifts.where((s) => s.date >= days[0] && s.date <= days[4])).filter((s) =>
    canEditDept(user, s.department),
  );
  if (!week.length) back('/scheduling?tab=templates', 'That week has no shifts to save', 'error');
  await shiftTemplates.mutate((rows) => {
    for (let i = rows.length - 1; i >= 0; i--)
      if (rows[i].template === parsed.data.name && canEditDept(user, rows[i].department)) rows.splice(i, 1);
    for (const s of week)
      rows.push({
        id: crypto.randomUUID(),
        template: parsed.data.name,
        weekday: days.indexOf(s.date) + 1,
        startTime: s.startTime,
        endTime: s.endTime,
        department: s.department,
        employeeId: s.employeeId,
      });
  });
  await audit(user.id, 'TEMPLATE_SAVED', 'ShiftTemplate', null, parsed.data.name);
  back('/scheduling?tab=templates', `Saved "${parsed.data.name}" with ${week.length} shifts`);
}

/** Create the template's shifts in a week. Shifts that would clash are created as open shifts instead. */
export async function applyTemplate(fd: FormData) {
  const user = await assertManager();
  const parsed = z.object({ name: z.string().min(1), week: z.iso.date() }).safeParse(formObject(fd));
  if (!parsed.success) back('/scheduling?tab=templates', firstError(parsed.error), 'error');
  const days = weekDays(parsed.data.week);
  const rows = (await shiftTemplates.where((t) => t.template === parsed.data.name)).filter((t) =>
    canEditDept(user, t.department),
  );
  let created = 0;
  let opened = 0;
  for (const t of rows) {
    const draft = {
      id: '',
      date: days[t.weekday - 1],
      startTime: t.startTime,
      endTime: t.endTime,
      employeeId: t.employeeId,
    };
    if (!draft.date) continue;
    const dup = await shifts.find(
      (s) =>
        s.date === draft.date &&
        s.startTime === t.startTime &&
        s.department === t.department &&
        s.employeeId === t.employeeId,
    );
    if (dup) continue;
    const why = await conflict(draft);
    if (why) opened++;
    await shifts.insert({
      date: draft.date,
      startTime: t.startTime,
      endTime: t.endTime,
      department: t.department,
      employeeId: why ? null : t.employeeId,
      reason: why ? `From template — ${why}` : null,
      createdById: user.id,
    });
    created++;
  }
  await audit(
    user.id,
    'TEMPLATE_APPLIED',
    'ShiftTemplate',
    null,
    `${parsed.data.name} → ${parsed.data.week}`,
  );
  back(
    `/scheduling?week=${parsed.data.week}`,
    `Added ${created} shift(s)${opened ? `, ${opened} left open because of clashes` : ''}`,
  );
}

export async function deleteTemplate(fd: FormData) {
  const user = await assertManager();
  const name = z.string().min(1).parse(fd.get('name'));
  await shiftTemplates.mutate((rows) => {
    for (let i = rows.length - 1; i >= 0; i--)
      if (rows[i].template === name && canEditDept(user, rows[i].department)) rows.splice(i, 1);
  });
  await audit(user.id, 'TEMPLATE_DELETED', 'ShiftTemplate', null, name);
  back('/scheduling?tab=templates', `Deleted "${name}"`);
}
