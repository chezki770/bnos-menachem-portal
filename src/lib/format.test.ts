import { describe, expect, it } from 'vitest';
import { hoursByLocalDay, zonedToUtcIso } from './format';

const NY = 'America/New_York';

describe('school time zone', () => {
  it('converts local wall-clock time to UTC, across daylight saving', () => {
    expect(zonedToUtcIso('2026-09-08', '08:00', NY)).toBe('2026-09-08T12:00:00.000Z'); // EDT
    expect(zonedToUtcIso('2026-12-08', '08:00', NY)).toBe('2026-12-08T13:00:00.000Z'); // EST
  });

  it('splits a punch that crosses local midnight', () => {
    // Sun Sep 13 23:00 → Mon Sep 14 01:00 New York time
    const split = hoursByLocalDay('2026-09-14T03:00:00.000Z', '2026-09-14T05:00:00.000Z', NY);
    expect(split).toEqual([
      { date: '2026-09-13', hours: 1 },
      { date: '2026-09-14', hours: 1 },
    ]);
  });

  it('keeps a same-day punch whole', () => {
    expect(hoursByLocalDay('2026-09-08T12:00:00.000Z', '2026-09-08T19:30:00.000Z', NY)).toEqual([
      { date: '2026-09-08', hours: 7.5 },
    ]);
  });

  it('handles the 23-hour day when clocks go forward', () => {
    // Mar 8, 2027 is not the change; Mar 14, 2027 is. 22:00 Mar 13 → 06:00 Mar 14 local = 7 real hours.
    const split = hoursByLocalDay(
      zonedToUtcIso('2027-03-13', '22:00', NY),
      zonedToUtcIso('2027-03-14', '06:00', NY),
      NY,
    );
    expect(split.map((d) => d.date)).toEqual(['2027-03-13', '2027-03-14']);
    expect(split.reduce((s, d) => s + d.hours, 0)).toBe(7);
  });
});
