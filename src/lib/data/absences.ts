import { z } from 'zod';
import { audit } from '@/lib/audit';
import {
  evaluateAbsence,
  schoolDays,
  SIMCHA_OCCASIONS,
  type AbsenceResult,
  type SimchaOccasion,
} from '@/lib/rules/absences';
import { ABSENCE_TYPES, absences, employees, type Employee } from '@/lib/store';
import { absenceUsage, employment } from './employees';
import { requireSchoolYear } from './years';

const isoDate = z.iso.date();

export const absenceInput = z
  .object({
    employeeId: z.string().min(1, 'Choose an employee'),
    type: z.enum(ABSENCE_TYPES),
    occasion: z
      .enum(Object.keys(SIMCHA_OCCASIONS) as [SimchaOccasion, ...SimchaOccasion[]])
      .optional()
      .or(z.literal('').transform(() => undefined)),
    startsOn: isoDate,
    endsOn: isoDate,
    adjacentToVacation: z.boolean().default(false),
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: 'End date is before start date', path: ['endsOn'] });
export type AbsenceInput = z.infer<typeof absenceInput>;

/** What the handbook rules give for this absence, using usage already posted this school year. */
export async function evaluateFor(
  employee: Employee,
  input: Omit<AbsenceInput, 'employeeId'>,
  schoolYearId: string,
): Promise<AbsenceResult & { days: number }> {
  const usage = await absenceUsage(employee.id, schoolYearId);
  const days = schoolDays(input.startsOn, input.endsOn);
  const span = (Date.parse(input.endsOn) - Date.parse(input.startsOn)) / 864e5;
  const result = evaluateAbsence({
    employee: employment(employee),
    type: input.type,
    occasion: input.occasion,
    days,
    adjacentToVacation: input.adjacentToVacation,
    ptoUsedDays: usage.ptoUsed,
    maternityPaidUsedDays: usage.maternityPaidUsed,
    calendarSpanDays: span,
  });
  return { ...result, days };
}

/** Evaluate and store an absence. The rule result is saved with it so history never changes. */
export async function postAbsence(
  actorId: string,
  input: AbsenceInput,
  requestId: string | null = null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const employee = await employees.get(input.employeeId);
  if (!employee) return { ok: false, error: 'Employee not found' };
  const year = await requireSchoolYear();
  const overlap = await absences.find(
    (a) => a.employeeId === employee.id && a.startsOn <= input.endsOn && input.startsOn <= a.endsOn,
  );
  if (overlap) return { ok: false, error: 'An absence is already posted for some of those dates' };
  const result = await evaluateFor(employee, input, year.id);
  if (!result.ok) return { ok: false, error: result.error };
  const row = await absences.insert({
    employeeId: employee.id,
    schoolYearId: year.id,
    type: input.type,
    occasion: input.type === 'SIMCHA' ? (input.occasion ?? null) : null,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    schoolDays: result.days,
    adjacentToVacation: input.adjacentToVacation,
    paidDays: result.paidDays,
    ptoDays: result.ptoDays,
    dockedDays: result.dockedDays,
    notes: result.notes.join('; ') || null,
    postedById: actorId,
    requestId,
    createdAt: new Date().toISOString(),
  });
  await audit(
    actorId,
    'ABSENCE_POSTED',
    'Absence',
    row.id,
    `${employee.name}: ${input.type} ${input.startsOn}–${input.endsOn}`,
  );
  return { ok: true, id: row.id };
}
