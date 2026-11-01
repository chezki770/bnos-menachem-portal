import { benefitRules, maternityPaidWeeks, ptoAllowanceDays, type Employment } from './benefits';

export type AbsenceType = 'SICK' | 'PERSONAL' | 'SIMCHA' | 'MATERNITY' | 'SNOW_DAY' | 'UNPAID';

/** Section E: paid simcha days by occasion. `week` = the employee's days per week. */
export const SIMCHA_OCCASIONS = {
  OWN_WEDDING: 'week',
  CHILD_WEDDING: 3,
  GRANDCHILD_WEDDING: 2,
  SIBLING_WEDDING: 2,
  CHILD_BAR_BAS_MITZVAH: 1,
  OWN_LECHAIM_MORNING: 1.5,
  OWN_LECHAIM_AFTERNOON: 1,
  CHILD_LECHAIM: 1,
  BRIS_NEPHEW: 0.25, // "2 hours"
  BRIS_GRANDCHILD: 1,
  SHIVA: 'week',
} as const;
export type SimchaOccasion = keyof typeof SIMCHA_OCCASIONS;

export type AbsenceInput = {
  employee: Employment;
  type: AbsenceType;
  occasion?: SimchaOccasion;
  /** School days in the absence (see schoolDays). */
  days: number;
  /** Day before/after a vacation or Yom Tov: unpaid days are double-docked (section B). */
  adjacentToVacation?: boolean;
  /** PTO days already used this school year. */
  ptoUsedDays: number;
  /** Paid maternity days already used this school year. */
  maternityPaidUsedDays?: number;
  /** Calendar length of the leave, for the 9-week return rule. */
  calendarSpanDays?: number;
};

export type AbsenceResult =
  | { ok: false; error: string }
  | { ok: true; paidDays: number; ptoDays: number; dockedDays: number; notes: string[] };

/** Monday–Friday days between two ISO dates, inclusive. -1 if end is before start. */
export function schoolDays(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  if (end < start) return -1;
  let n = 0;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd >= 1 && wd <= 5) n++;
  }
  return n;
}

export function evaluateAbsence(input: AbsenceInput): AbsenceResult {
  const { employee, type, days } = input;
  if (days < 0) return { ok: false, error: 'End date is before start date' };
  if (days === 0) return { ok: false, error: 'No school days (Mon–Fri) in that range' };
  const rules = benefitRules(employee);
  if (!rules) return { ok: false, error: 'Employee has no periods per week set' };

  const ptoLeft = Math.max(0, ptoAllowanceDays(employee) - input.ptoUsedDays);
  const notes: string[] = [];
  let paid = 0, pto = 0, docked = 0;

  switch (type) {
    case 'SNOW_DAY':
      paid = days;
      notes.push('Excused snow day — not deducted');
      break;
    case 'SIMCHA': {
      if (!rules.simchaAndMaternity) return { ok: false, error: 'Not eligible for simcha days (needs 9+ periods a week)' };
      if (!input.occasion) return { ok: false, error: 'Choose the simcha occasion' };
      const raw = SIMCHA_OCCASIONS[input.occasion];
      const allowance = raw === 'week' ? employee.daysPerWeek : raw;
      paid = Math.min(days, allowance);
      const rest = days - paid;
      pto = Math.min(rest, ptoLeft);
      docked = rest - pto;
      notes.push(`Simcha allowance: ${allowance} day(s), not taken from PTO`);
      if (rest > 0) notes.push(`${rest} day(s) beyond the allowance`);
      break;
    }
    case 'MATERNITY': {
      if (!rules.simchaAndMaternity) return { ok: false, error: 'Not eligible for maternity leave (needs 9+ periods a week)' };
      const total = maternityPaidWeeks(employee.yearsAtSchool) * employee.daysPerWeek;
      const remaining = Math.max(0, total - (input.maternityPaidUsedDays ?? 0));
      paid = Math.min(days, remaining);
      docked = days - paid;
      notes.push(`${maternityPaidWeeks(employee.yearsAtSchool)} paid week(s); ${remaining} of ${total} days remaining. Pay requires returning within 9 weeks`);
      if ((input.calendarSpanDays ?? 0) > 63) notes.push('Leave is longer than 9 weeks — paid portion is at risk');
      break;
    }
    case 'SICK':
    case 'PERSONAL':
      if (rules.basis === 'HOURLY') {
        docked = days;
        notes.push('Hourly employee — paid only on days present');
      } else {
        pto = Math.min(days, ptoLeft);
        docked = days - pto;
        if (docked > 0) notes.push('PTO used up — remaining days are deducted from pay');
      }
      break;
    case 'UNPAID':
      docked = days;
      notes.push('Unpaid day');
      break;
  }

  if (input.adjacentToVacation && docked > 0) {
    docked *= 2;
    notes.push('Next to a vacation/Yom Tov — double-docked');
  }
  return { ok: true, paidDays: paid, ptoDays: pto, dockedDays: docked, notes };
}
