import { describe, expect, it } from 'vitest';
import { evaluateAbsence, schoolDays } from './absences';
import { benefitRules, maternityPaidWeeks, ptoAllowanceDays } from './benefits';

const emp = (periodsPerWeek: number, yearsAtSchool = 1, daysPerWeek = 5) => ({
  periodsPerWeek,
  yearsAtSchool,
  daysPerWeek,
});

describe('benefit eligibility (handbook C)', () => {
  it('1–8 periods is hourly with no benefits', () => {
    expect(benefitRules(emp(8))).toMatchObject({
      basis: 'HOURLY',
      pto: false,
      tuitionAndParsonage: false,
      yomtovAndVacation: 'NO',
    });
  });
  it('9–14 periods gets tuition and PTO but no yomtov before year 10', () => {
    expect(benefitRules(emp(12, 2))).toMatchObject({
      pto: true,
      tuitionAndParsonage: true,
      yomtovAndVacation: 'NO',
    });
  });
  it('10th year with 10+ periods (not 15) gets yomtov and vacation', () => {
    expect(benefitRules(emp(12, 10))?.yomtovAndVacation).toBe('ELIGIBLE');
    expect(benefitRules(emp(9, 12))?.yomtovAndVacation).toBe('NO');
  });
  it('15+ periods is paid for yomtov and vacation', () => {
    expect(benefitRules(emp(15))?.yomtovAndVacation).toBe('PAID');
  });
  it('PTO is one week of working days; none for hourly', () => {
    expect(ptoAllowanceDays(emp(12, 1, 4))).toBe(4);
    expect(ptoAllowanceDays(emp(6))).toBe(0);
  });
  it('maternity weeks by year', () => {
    expect([1, 2, 3, 5, 6, 9, 10, 20].map(maternityPaidWeeks)).toEqual([2, 2, 3, 3, 4, 4, 6, 6]);
  });
});

describe('absences', () => {
  const taylor = emp(12, 2, 4);
  it('sick day uses PTO', () => {
    expect(evaluateAbsence({ employee: taylor, type: 'SICK', days: 1, ptoUsedDays: 0 })).toMatchObject({
      ok: true,
      ptoDays: 1,
      dockedDays: 0,
    });
  });
  it('days beyond PTO are docked', () => {
    expect(evaluateAbsence({ employee: taylor, type: 'SICK', days: 7, ptoUsedDays: 1 })).toMatchObject({
      ptoDays: 3,
      dockedDays: 4,
    });
  });
  it('adjacent to vacation double-docks the unpaid part', () => {
    expect(
      evaluateAbsence({
        employee: taylor,
        type: 'UNPAID',
        days: 1,
        ptoUsedDays: 0,
        adjacentToVacation: true,
      }),
    ).toMatchObject({ dockedDays: 2 });
  });
  it('hourly employees never use PTO and cannot take simcha', () => {
    const casey = emp(8, 3);
    expect(evaluateAbsence({ employee: casey, type: 'SICK', days: 1, ptoUsedDays: 0 })).toMatchObject({
      ptoDays: 0,
      dockedDays: 1,
    });
    expect(
      evaluateAbsence({ employee: casey, type: 'SIMCHA', occasion: 'SHIVA', days: 1, ptoUsedDays: 0 }),
    ).toMatchObject({ ok: false });
  });
  it('simcha is paid up to the allowance and not taken from PTO', () => {
    expect(
      evaluateAbsence({
        employee: taylor,
        type: 'SIMCHA',
        occasion: 'CHILD_WEDDING',
        days: 3,
        ptoUsedDays: 0,
      }),
    ).toMatchObject({ paidDays: 3, ptoDays: 0 });
    expect(
      evaluateAbsence({ employee: taylor, type: 'SIMCHA', occasion: 'OWN_WEDDING', days: 6, ptoUsedDays: 0 }),
    ).toMatchObject({ paidDays: 4, ptoDays: 2 });
  });
  it('maternity pays by year, rest unpaid', () => {
    expect(evaluateAbsence({ employee: taylor, type: 'MATERNITY', days: 10, ptoUsedDays: 0 })).toMatchObject({
      paidDays: 8,
      dockedDays: 2,
    });
    expect(
      evaluateAbsence({
        employee: taylor,
        type: 'MATERNITY',
        days: 5,
        ptoUsedDays: 0,
        maternityPaidUsedDays: 6,
      }),
    ).toMatchObject({ paidDays: 2, dockedDays: 3 });
  });
  it('snow days are excused', () => {
    expect(evaluateAbsence({ employee: taylor, type: 'SNOW_DAY', days: 1, ptoUsedDays: 4 })).toMatchObject({
      paidDays: 1,
      ptoDays: 0,
      dockedDays: 0,
    });
  });
  it('counts only Mon–Fri and validates the range', () => {
    expect(schoolDays('2026-09-08', '2026-09-16')).toBe(7);
    expect(schoolDays('2026-09-12', '2026-09-13')).toBe(0);
    expect(schoolDays('2026-09-16', '2026-09-08')).toBe(-1);
  });
});
