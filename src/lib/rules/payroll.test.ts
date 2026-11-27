import { describe, expect, it } from 'vitest';
import {
  adjustmentsTotalCents,
  dockedCents,
  hourlyGrossCents,
  payrollStatus,
  salariedPeriodGrossCents,
  semiMonthlyPeriods,
  splitOvertime,
  weekStart,
  workdaysInYear,
} from './payroll';

describe('overtime', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-09-09')).toBe('2026-09-07'); // Wed → Mon
    expect(weekStart('2026-09-13')).toBe('2026-09-07'); // Sun → previous Mon
    expect(weekStart('2026-09-07')).toBe('2026-09-07');
  });
  it('no overtime at or under 40 hours a week', () => {
    const days = ['07', '08', '09', '10', '11'].map((d) => ({ date: `2026-09-${d}`, hours: 8 }));
    expect(splitOvertime(days).every((d) => d.overtime === 0)).toBe(true);
  });
  it('hours past 40 in the week are overtime, in date order', () => {
    const days = ['07', '08', '09', '10', '11'].map((d) => ({ date: `2026-09-${d}`, hours: 9 }));
    const split = splitOvertime(days);
    expect(split.map((d) => d.overtime)).toEqual([0, 0, 0, 0, 5]);
    expect(split[4].regular).toBe(4);
  });
  it('each week is counted on its own', () => {
    const split = splitOvertime([
      { date: '2026-09-11', hours: 45 },
      { date: '2026-09-14', hours: 10 },
    ]);
    expect(split).toEqual([
      { date: '2026-09-11', regular: 40, overtime: 5 },
      { date: '2026-09-14', regular: 10, overtime: 0 },
    ]);
  });
  it('merges several punches on the same day', () => {
    expect(
      splitOvertime([
        { date: '2026-09-07', hours: 3 },
        { date: '2026-09-07', hours: 2.5 },
      ]),
    ).toEqual([{ date: '2026-09-07', regular: 5.5, overtime: 0 }]);
  });
});

describe('gross pay', () => {
  it('hourly pays 1.5× for overtime', () => {
    expect(hourlyGrossCents(2000, 40, 2)).toBe(80000 + 6000);
  });
  it('salaried splits the year evenly', () => {
    expect(salariedPeriodGrossCents(4_800_000, 20)).toBe(240_000);
    expect(salariedPeriodGrossCents(1000, 0)).toBe(0);
  });
  it('docked days cost a day of salary', () => {
    expect(workdaysInYear('2026-09-07', '2026-09-18', 4)).toBe(8);
    expect(dockedCents(4_000_000, 200, 2)).toBe(40_000);
    expect(dockedCents(4_000_000, 0, 2)).toBe(0);
  });
  it('deductions subtract, bonuses and reimbursements add', () => {
    expect(
      adjustmentsTotalCents([
        { kind: 'BONUS', cents: 500 },
        { kind: 'DEDUCTION', cents: 200 },
        { kind: 'REIMBURSEMENT', cents: 100 },
      ]),
    ).toBe(400);
  });
});

describe('payroll status', () => {
  const ok = {
    contractSigned: true,
    hasDirectDeposit: true,
    hourly: true,
    timeCardApproved: true,
    hasPayRate: true,
  };
  it('ready when everything is in place', () => expect(payrollStatus(ok)).toBe('READY'));
  it('unsigned contract blocks first', () =>
    expect(payrollStatus({ ...ok, contractSigned: false, hasDirectDeposit: false })).toBe(
      'BLOCKED_CONTRACT',
    ));
  it('missing direct deposit', () =>
    expect(payrollStatus({ ...ok, hasDirectDeposit: false })).toBe('MISSING_DIRECT_DEPOSIT'));
  it('hourly needs an approved time card; salaried does not', () => {
    expect(payrollStatus({ ...ok, timeCardApproved: false })).toBe('BLOCKED_TIME_CARD');
    expect(payrollStatus({ ...ok, hourly: false, timeCardApproved: false })).toBe('READY');
  });
});

describe('pay periods', () => {
  it('semi-monthly across months, pay date 3 days after', () => {
    expect(semiMonthlyPeriods('2026-09-01', '2026-10-31')).toEqual([
      { startsOn: '2026-09-01', endsOn: '2026-09-15', payDate: '2026-09-18' },
      { startsOn: '2026-09-16', endsOn: '2026-09-30', payDate: '2026-10-03' },
      { startsOn: '2026-10-01', endsOn: '2026-10-15', payDate: '2026-10-18' },
      { startsOn: '2026-10-16', endsOn: '2026-10-31', payDate: '2026-11-03' },
    ]);
  });
  it('handles February and a mid-month start', () => {
    const p = semiMonthlyPeriods('2027-02-20', '2027-02-28');
    expect(p).toEqual([{ startsOn: '2027-02-16', endsOn: '2027-02-28', payDate: '2027-03-03' }]);
  });
});
