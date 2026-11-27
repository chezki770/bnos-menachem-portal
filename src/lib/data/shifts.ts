import { addDays, todayIso } from '@/lib/format';
import { shifts, type Shift } from '@/lib/store';

/** Monday of the week for a date; weekends roll forward to the coming week. */
export function mondayOf(iso: string): string {
  const wd = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd);
}

export function weekDays(monday: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

/** True only for a real calendar date in YYYY-MM-DD form (2026-02-30 and 2026-99-99 are not). */
export function isRealDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The ?week= value as a Monday; anything that isn't a real date falls back to this week. */
export function parseWeek(param: string | undefined): string {
  return mondayOf(isRealDate(param) ? param : todayIso());
}

export async function shiftsBetween(from: string, to: string, pred: (s: Shift) => boolean = () => true) {
  return (await shifts.where((s) => s.date >= from && s.date <= to && pred(s))).sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
}

export function shiftHours(s: Pick<Shift, 'startTime' | 'endTime'>): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return Math.max(0, (m(s.endTime) - m(s.startTime)) / 60);
}
