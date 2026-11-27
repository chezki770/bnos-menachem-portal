'use server';

import { z } from 'zod';
import { back, firstError, formObject } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { assertAdmin } from '@/lib/auth/current-user';
import { semiMonthlyPeriods } from '@/lib/rules/payroll';
import { departments, employees, payPeriods, schoolYears, shifts } from '@/lib/store';

const S = '/settings';

export async function addSchoolYear(fd: FormData) {
  const actor = await assertAdmin();
  const parsed = z
    .object({
      label: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{4}$/, 'Label like 2027-2028'),
      startsOn: z.iso.date(),
      endsOn: z.iso.date(),
    })
    .refine((v) => v.endsOn > v.startsOn, { message: 'End must be after start' })
    .safeParse(formObject(fd));
  if (!parsed.success) back(S, firstError(parsed.error), 'error');
  const ok = await schoolYears.mutate((rows) => {
    if (rows.some((r) => r.label === parsed.data.label)) return false;
    rows.push({ id: crypto.randomUUID(), ...parsed.data, current: rows.length === 0 });
    return true;
  });
  if (!ok) back(S, 'That school year already exists', 'error');
  await audit(actor.id, 'SCHOOL_YEAR_ADDED', 'SchoolYear', null, parsed.data.label);
  back(S, `Added ${parsed.data.label}`);
}

export async function setCurrentYear(fd: FormData) {
  const actor = await assertAdmin();
  const id = z.string().min(1).parse(fd.get('id'));
  await schoolYears.mutate((rows) => rows.forEach((r) => (r.current = r.id === id)));
  await audit(actor.id, 'SCHOOL_YEAR_CURRENT', 'SchoolYear', id);
  back(S, 'Current school year changed');
}

export async function generatePayPeriods(fd: FormData) {
  const actor = await assertAdmin();
  const id = z.string().min(1).parse(fd.get('id'));
  const year = await schoolYears.get(id);
  if (!year) back(S, 'School year not found', 'error');
  const added = await payPeriods.mutate((rows) => {
    let n = 0;
    for (const p of semiMonthlyPeriods(year.startsOn, year.endsOn)) {
      if (rows.some((r) => r.schoolYearId === id && r.startsOn === p.startsOn)) continue;
      rows.push({
        id: crypto.randomUUID(),
        schoolYearId: id,
        ...p,
        status: 'DRAFT',
        submittedAt: null,
        submittedById: null,
      });
      n++;
    }
    return n;
  });
  await audit(actor.id, 'PAY_PERIODS_GENERATED', 'SchoolYear', id, String(added));
  back(S, added ? `Added ${added} semi-monthly pay periods` : 'Pay periods already exist for that year');
}

export async function addDepartment(fd: FormData) {
  const actor = await assertAdmin();
  const parsed = z
    .object({ name: z.string().trim().min(2).max(60), handbook: z.string().trim().max(60).optional() })
    .safeParse(formObject(fd));
  if (!parsed.success) back(S, firstError(parsed.error), 'error');
  const ok = await departments.mutate((rows) => {
    if (rows.some((r) => r.name.toLowerCase() === parsed.data.name.toLowerCase())) return false;
    rows.push({ id: crypto.randomUUID(), name: parsed.data.name, handbook: parsed.data.handbook || null });
    return true;
  });
  if (!ok) back(S, 'That department already exists', 'error');
  await audit(actor.id, 'DEPARTMENT_ADDED', 'Department', null, parsed.data.name);
  back(S, `Added ${parsed.data.name}`);
}

export async function deleteDepartment(fd: FormData) {
  const actor = await assertAdmin();
  const id = z.string().min(1).parse(fd.get('id'));
  const d = await departments.get(id);
  if (!d) back(S, 'Department not found', 'error');
  const used =
    (await employees.find((e) => e.department === d.name)) ||
    (await shifts.find((s) => s.department === d.name));
  if (used) back(S, `${d.name} still has employees or shifts`, 'error');
  await departments.remove(id);
  await audit(actor.id, 'DEPARTMENT_DELETED', 'Department', id, d.name);
  back(S, `Removed ${d.name}`);
}
