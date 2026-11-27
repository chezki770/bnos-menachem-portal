import { describe, expect, it } from 'vitest';
import { isRealDate, parseWeek } from './shifts';

describe('week parameter', () => {
  it('accepts real dates and rolls them to Monday', () => {
    expect(parseWeek('2026-09-09')).toBe('2026-09-07');
  });
  it.each(['2026-99-99', '2026-02-30', '2026-13-01', 'nope', ''])('falls back to this week for %j', (v) => {
    expect(isRealDate(v)).toBe(false);
    expect(() => parseWeek(v)).not.toThrow();
    expect(parseWeek(v)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
