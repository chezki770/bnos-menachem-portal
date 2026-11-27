import { benefitRules, ptoAllowanceDays } from '@/lib/rules/benefits';
import type { Contract, Employee, SchoolYear } from '@/lib/store';
import { fmtDate, money } from './format';

/** The contract text, built from the terms saved on the contract row (not today's employee data). */
export function contractSections(c: Contract, emp: Employee, year: SchoolYear | undefined) {
  const emp4rules = {
    periodsPerWeek: c.periodsPerWeek,
    yearsAtSchool: emp.yearsAtSchool,
    daysPerWeek: emp.daysPerWeek,
  };
  const rules = benefitRules(emp4rules);
  const pay =
    c.type === 'HOURLY'
      ? `${money(c.hourlyRateCents)} per hour, paid for hours recorded on the time clock and approved.`
      : `${money(c.annualSalaryCents)} for the school year, paid in equal semi-monthly installments, less any deductions under the handbook.`;
  return [
    {
      title: 'Parties and term',
      body: `This agreement is between Bnos Menachem ("the School") and ${emp.name} ("the Employee") for the ${year?.label ?? ''} school year${year ? `, ${fmtDate(year.startsOn)} to ${fmtDate(year.endsOn)}` : ''}.`,
    },
    {
      title: 'Position',
      body: `${emp.position ?? 'Staff member'}, ${emp.department} department, ${c.periodsPerWeek} periods per week over ${emp.daysPerWeek} days.`,
    },
    { title: 'Compensation', body: pay },
    {
      title: 'Benefits',
      body: rules
        ? [
            `Pay basis: ${rules.basis === 'HOURLY' ? 'hourly, paid when present' : 'per period / salaried'}.`,
            `Tuition and parsonage: ${rules.tuitionAndParsonage ? 'eligible' : 'not eligible'}.`,
            `Paid time off: ${rules.pto ? `${ptoAllowanceDays(emp4rules)} day(s) for the year` : 'not eligible'}.`,
            `Simcha days and maternity leave: ${rules.simchaAndMaternity ? 'eligible, as set out in the handbook' : 'not eligible'}.`,
          ].join(' ')
        : 'As set out in the employee handbook.',
    },
    {
      title: 'Employee handbook',
      body: `The Bnos Menachem employee handbook (${c.handbookVersion ?? 'current edition'}) is part of this contract, including its rules on punctuality, attendance and docking, PTO, simcha days and maternity leave.`,
    },
    {
      title: 'Documents',
      body: 'The Employee will provide a completed W‑4, I‑9, IT‑2104, ID and direct deposit form before the first payroll. Payment cannot be made until this contract is signed and these forms are on file.',
    },
  ];
}
