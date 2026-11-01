/** Handbook section C — benefit eligibility. Pure functions: no I/O, easy to test. */
export type Employment = {
  periodsPerWeek: number;
  yearsAtSchool: number;
  daysPerWeek: number;
};

export type BenefitRules = {
  basis: 'HOURLY' | 'PER_PERIOD';
  tuitionAndParsonage: boolean;
  pto: boolean;
  /** Simcha days and maternity leave apply only to PTO-eligible employees. */
  simchaAndMaternity: boolean;
  yomtovAndVacation: 'NO' | 'ELIGIBLE' | 'PAID';
};

export function benefitRules({ periodsPerWeek: p, yearsAtSchool: y }: Employment): BenefitRules | null {
  if (!(p > 0)) return null;
  if (p <= 8) {
    return {
      basis: 'HOURLY',
      tuitionAndParsonage: false,
      pto: false,
      simchaAndMaternity: false,
      yomtovAndVacation: 'NO',
    };
  }
  const base = {
    basis: 'PER_PERIOD' as const,
    tuitionAndParsonage: true,
    pto: true,
    simchaAndMaternity: true,
  };
  if (p >= 15) return { ...base, yomtovAndVacation: 'PAID' };
  // 9–14 periods: yomtov/vacation only from the 10th year with at least 10 periods
  return { ...base, yomtovAndVacation: y >= 10 && p >= 10 ? 'ELIGIBLE' : 'NO' };
}

/** Section D: PTO is one week's worth of the employee's working days. */
export function ptoAllowanceDays(emp: Employment): number {
  return benefitRules(emp)?.pto ? emp.daysPerWeek : 0;
}

/** Section F: paid maternity weeks by year of employment. */
export function maternityPaidWeeks(yearsAtSchool: number): number {
  if (yearsAtSchool >= 10) return 6;
  if (yearsAtSchool >= 6) return 4;
  if (yearsAtSchool >= 3) return 3;
  return 2;
}
