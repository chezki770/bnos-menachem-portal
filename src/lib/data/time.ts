import { splitOvertime, weekStart, round2, type DaySplit } from '@/lib/rules/payroll';
import { timeCards, timeEntries, type PayPeriod, type TimeCard, type TimeEntry } from '@/lib/store';
import { addDays, localDate } from '@/lib/format';

export function entryHours(e: TimeEntry): number {
  if (!e.clockOut) return 0;
  return Math.max(0, (Date.parse(e.clockOut) - Date.parse(e.clockIn)) / 3600_000);
}

export async function entriesBetween(employeeId: string, fromIso: string, toIso: string) {
  return (await timeEntries.where((e) => e.employeeId === employeeId))
    .filter((e) => {
      const d = localDate(e.clockIn);
      return d >= fromIso && d <= toIso;
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
};

/** Hours for a pay period, with weekly overtime counted across the full Monday–Sunday weeks. */
export async function timeCardSummary(employeeId: string, period: PayPeriod): Promise<TimeCardSummary> {
  const from = weekStart(period.startsOn);
  const to = addDays(weekStart(period.endsOn), 6);
  const all = await entriesBetween(employeeId, from, to);
  const split = splitOvertime(all.map((e) => ({ date: localDate(e.clockIn), hours: entryHours(e) })));
  const days = split.filter((d) => d.date >= period.startsOn && d.date <= period.endsOn);
  const entries = all.filter((e) => {
    const d = localDate(e.clockIn);
    return d >= period.startsOn && d <= period.endsOn;
  });
  const regular = round2(days.reduce((s, d) => s + d.regular, 0));
  const overtime = round2(days.reduce((s, d) => s + d.overtime, 0));
  const card = await timeCards.find((c) => c.employeeId === employeeId && c.payPeriodId === period.id);
  return {
    days,
    entries,
    regular,
    overtime,
    total: round2(regular + overtime),
    card,
    hasOpenEntry: entries.some((e) => !e.clockOut),
  };
}
