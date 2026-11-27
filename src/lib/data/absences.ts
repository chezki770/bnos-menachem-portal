import { z } from 'zod';
import { audit } from '@/lib/audit';
import {
  absenceUsageTotals,
  evaluateAbsence,
  schoolDays,
  SIMCHA_OCCASIONS,
  type AbsenceResult,
  type SimchaOccasion,
} from '@/lib/rules/absences';
import { ABSENCE_TYPES, absences, employees, type Employee } from '@/lib/store';
import { absenceUsage, employment } from './employees';
import { schoolYearForDates } from './years';

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

type Usage = { ptoUsed: number; maternityPaidUsed: number };

function evaluateWith(
  employee: Employee,
  input: Omit<AbsenceInput, 'employeeId'>,
  usage: Usage,
): AbsenceResult & { days: number } {
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

/** What the handbook rules give for this absence, using usage already posted this school year. */
export async function evaluateFor(
  employee: Employee,
  input: Omit<AbsenceInput, 'employeeId'>,
  schoolYearId: string,
): Promise<AbsenceResult & { days: number }> {
  return evaluateWith(employee, input, await absenceUsage(employee.id, schoolYearId));
}

/**
 * Evaluate and store an absence. The overlap check, PTO/maternity usage and the insert all happen
 * under the absences file lock, so two posts at once can't both use the last PTO day or overlap.
 * The rule result is saved with the absence so history never changes.
 */
export async function postAbsence(
  actorId: string,
  input: AbsenceInput,
  requestId: string | null = null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const employee = await employees.get(input.employeeId);
  if (!employee) return { ok: false, error: 'Employee not found' };
  // PTO and maternity usage are per school year: use the year the dates fall in, not today's.
  const resolved = await schoolYearForDates(input.startsOn, input.endsOn);
  if (!resolved.ok) return resolved;
  const year = resolved.year;
  const res = await absences.mutate((rows): { ok: true; id: string } | { ok: false; error: string } => {
    const mine = rows.filter((a) => a.employeeId === employee.id);
    if (mine.some((a) => a.startsOn <= input.endsOn && input.startsOn <= a.endsOn))
      return { ok: false, error: 'An absence is already posted for some of those dates' };
    const thisYear = mine.filter((a) => a.schoolYearId === year.id);
    const result = evaluateWith(employee, input, absenceUsageTotals(thisYear));
    if (!result.ok) return { ok: false, error: result.error };
    const id = crypto.randomUUID();
    rows.push({
      id,
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
    return { ok: true, id };
  });
  if (!res.ok) return res;
  await audit(actorId, 'ABSENCE_POSTED', 'Absence', res.id, `${employee.name}: ${input.type} ${input.startsOn}–${input.endsOn}`);
  return res;
}
