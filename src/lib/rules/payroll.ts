/**
 * Payroll rules for the export to the payroll provider. Pure functions: no I/O.
 * Taxes and net pay are the provider's job; the portal works out hours, gross, docking and adjustments.
 */
import { schoolDays } from './absences';

export const OVERTIME_WEEKLY_HOURS = 40;
export const OVERTIME_MULTIPLIER = 1.5;

export type DayHours = { date: string; hours: number };
export type DaySplit = { date: string; regular: number; overtime: number };

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing the date. */
export function weekStart(iso: string): string {
  const wd = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

/**
 * Overtime is hours over 40 per Monday–Sunday week, counted in date order: the hours that push the
 * week past 40 are overtime. Pass every day of each week that touches the pay period, then keep only
 * the days inside the period, so weeks that straddle two periods are still counted correctly.
 */
export function splitOvertime(days: DayHours[]): DaySplit[] {
  const byDate = new Map<string, number>();
  for (const d of days) byDate.set(d.date, (byDate.get(d.date) ?? 0) + Math.max(0, d.hours));
  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const weekTotals = new Map<string, number>();
  return sorted.map(([date, hours]) => {
    const wk = weekStart(date);
    const before = weekTotals.get(wk) ?? 0;
    const after = before + hours;
    weekTotals.set(wk, after);
    const overtime = Math.max(0, after - Math.max(before, OVERTIME_WEEKLY_HOURS));
    return { date, regular: round2(hours - overtime), overtime: round2(overtime) };
  });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function hourlyGrossCents(rateCents: number, regularHours: number, overtimeHours: number): number {
  return Math.round(rateCents * regularHours + rateCents * OVERTIME_MULTIPLIER * overtimeHours);
}

/** Salaried / per-period staff: the annual salary split evenly across the year's pay periods. */
export function salariedPeriodGrossCents(annualSalaryCents: number, payPeriodsInYear: number): number {
  if (payPeriodsInYear <= 0) return 0;
  return Math.round(annualSalaryCents / payPeriodsInYear);
}

/** Contracted working days in the school year (Mon–Fri days scaled to the employee's days per week). */
export function workdaysInYear(startIso: string, endIso: string, daysPerWeek: number): number {
  return Math.max(0, schoolDays(startIso, endIso)) * (daysPerWeek / 5);
}

/** A docked day costs one day's share of the annual salary. */
export function dockedCents(annualSalaryCents: number, yearWorkdays: number, dockedDays: number): number {
  if (yearWorkdays <= 0 || dockedDays <= 0) return 0;
  return Math.round((annualSalaryCents / yearWorkdays) * dockedDays);
}

/**
 * The part of an absence's docked days that falls in a date range (a pay period). An absence that
 * spans two periods is docked in each in proportion to its school days there; the stored total
 * (including any double-docking) is what gets split, so the periods always add up to it.
 */
export function dockedDaysInRange(
  a: { startsOn: string; endsOn: string; schoolDays: number; dockedDays: number },
  fromIso: string,
  toIso: string,
): number {
  if (a.dockedDays <= 0) return 0;
  const start = a.startsOn > fromIso ? a.startsOn : fromIso;
  const end = a.endsOn < toIso ? a.endsOn : toIso;
  if (end < start) return 0;
  const total = a.schoolDays > 0 ? a.schoolDays : schoolDays(a.startsOn, a.endsOn);
  if (total <= 0) return 0;
  return round2((a.dockedDays * Math.max(0, schoolDays(start, end))) / total);
}

export type AdjustmentKind = 'BONUS' | 'DEDUCTION' | 'REIMBURSEMENT';

export function adjustmentsTotalCents(adjs: { kind: AdjustmentKind; cents: number }[]): number {
  return adjs.reduce((sum, a) => sum + (a.kind === 'DEDUCTION' ? -a.cents : a.cents), 0);
}

export type PayrollStatus =
  'READY' | 'BLOCKED_CONTRACT' | 'MISSING_DIRECT_DEPOSIT' | 'BLOCKED_TIME_CARD' | 'MISSING_PAY_RATE';

export const PAYROLL_STATUS_LABEL: Record<PayrollStatus, string> = {
  READY: 'Ready',
  BLOCKED_CONTRACT: 'Blocked — contract not signed',
  MISSING_DIRECT_DEPOSIT: 'Missing direct deposit',
  BLOCKED_TIME_CARD: 'Blocked — time card not approved',
  MISSING_PAY_RATE: 'Missing pay rate',
};

/** Employees are skipped from a run until their contract is signed, direct deposit is on file and (hourly) their time card is approved. */
export function payrollStatus(input: {
  contractSigned: boolean;
  hasDirectDeposit: boolean;
  hourly: boolean;
  timeCardApproved: boolean;
  hasPayRate: boolean;
}): PayrollStatus {
  if (!input.contractSigned) return 'BLOCKED_CONTRACT';
  if (!input.hasDirectDeposit) return 'MISSING_DIRECT_DEPOSIT';
  if (!input.hasPayRate) return 'MISSING_PAY_RATE';
  if (input.hourly && !input.timeCardApproved) return 'BLOCKED_TIME_CARD';
  return 'READY';
}

export type PeriodDates = { startsOn: string; endsOn: string; payDate: string };

/** Semi-monthly periods (1st–15th, 16th–end of month) covering the school year. Pay date is 3 days after the period ends. */
export function semiMonthlyPeriods(startIso: string, endIso: string): PeriodDates[] {
  const out: PeriodDates[] = [];
  let cursor = startIso.slice(0, 8) + (Number(startIso.slice(8)) <= 15 ? '01' : '16');
  while (cursor <= endIso) {
    const [y, m, d] = cursor.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const endsOn =
      d === 1 ? `${cursor.slice(0, 8)}15` : `${cursor.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
    out.push({ startsOn: cursor, endsOn, payDate: addDays(endsOn, 3) });
    cursor = addDays(endsOn, 1);
  }
  return out;
}
