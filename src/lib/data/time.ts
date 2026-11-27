import { splitOvertime, weekStart, round2, type DaySplit } from '@/lib/rules/payroll';
import { timeCards, timeEntries, type PayPeriod, type TimeCard, type TimeEntry } from '@/lib/store';
import { addDays, hoursByLocalDay, localDate } from '@/lib/format';

export function entryHours(e: TimeEntry): number {
  if (!e.clockOut) return 0;
  return Math.max(0, (Date.parse(e.clockOut) - Date.parse(e.clockIn)) / 3600_000);
}

/** Punches that touch any school-local day from fromIso to toIso (a punch past midnight counts on both days). */
export async function entriesBetween(employeeId: string, fromIso: string, toIso: string) {
  return (await timeEntries.where((e) => e.employeeId === employeeId))
    .filter((e) => {
      const start = localDate(e.clockIn);
      const end = e.clockOut ? localDate(e.clockOut) : start;
      return start <= toIso && end >= fromIso;
    })
    .sort((a, b) => a.clockIn.localeCompare(b.clockIn));
}

export async function openEntry(employeeId: string): Promise<TimeEntry | undefined> {
  return timeEntries.find((e) => e.employeeId === employeeId && !e.clockOut);
}

export type TimeCardSummary = {
  days: DaySplit[];
  entries: TimeEntry[];
  regular: number;
  overtime: number;
  total: number;
  card: TimeCard | undefined;
  hasOpenEntry: boolean;
  /** APPROVED, and the hours still match what was approved. */
  approvalValid: boolean;
  /** MISSING | SUBMITTED | APPROVED | NEEDS_CHANGES | CHANGED (approved, then the punches changed) */
  status: string;
};

/**
 * Hours for a pay period. Punches are split at school-local midnight, and weekly overtime is counted
 * across the full Monday–Sunday weeks, including days just outside the period.
 */
export async function timeCardSummary(employeeId: string, period: PayPeriod): Promise<TimeCardSummary> {
  const from = weekStart(period.startsOn);
  const to = addDays(weekStart(period.endsOn), 6);
  const all = await entriesBetween(employeeId, from, to);
  const pieces = all.flatMap((e) => (e.clockOut ? hoursByLocalDay(e.clockIn, e.clockOut) : []));
  const split = splitOvertime(pieces.filter((p) => p.date >= from && p.date <= to));
  const days = split.filter((d) => d.date >= period.startsOn && d.date <= period.endsOn);
  const entries = all.filter((e) => {
    const start = localDate(e.clockIn);
    const end = e.clockOut ? localDate(e.clockOut) : start;
    return start <= period.endsOn && end >= period.startsOn;
  });
  const regular = round2(days.reduce((s, d) => s + d.regular, 0));
  const overtime = round2(days.reduce((s, d) => s + d.overtime, 0));
  const card = await timeCards.find((c) => c.employeeId === employeeId && c.payPeriodId === period.id);
  const hasOpenEntry = entries.some((e) => !e.clockOut);
  const approvalValid =
    card?.status === 'APPROVED' &&
    !hasOpenEntry &&
    card.approvedRegularHours === regular &&
    card.approvedOvertimeHours === overtime;
  const status = !card ? 'MISSING' : card.status === 'APPROVED' && !approvalValid ? 'CHANGED' : card.status;
  return { days, entries, regular, overtime, total: round2(regular + overtime), card, hasOpenEntry, approvalValid, status };
}
