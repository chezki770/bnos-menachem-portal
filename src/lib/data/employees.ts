import type { SessionUser } from '@/lib/auth/current-user';
import { absenceUsageTotals } from '@/lib/rules/absences';
import { benefitRules, maternityPaidWeeks, ptoAllowanceDays, type Employment } from '@/lib/rules/benefits';
import { absences, contracts, employees, type Employee } from '@/lib/store';
import { currentSchoolYear } from './years';

export function employment(
  e: Pick<Employee, 'periodsPerWeek' | 'yearsAtSchool' | 'daysPerWeek'>,
): Employment {
  return { periodsPerWeek: e.periodsPerWeek, yearsAtSchool: e.yearsAtSchool, daysPerWeek: e.daysPerWeek };
}

/** Hourly staff (1–8 periods, per the handbook) clock in and out and are paid by approved hours. */
export function isHourly(e: Employee): boolean {
  return benefitRules(employment(e))?.basis === 'HOURLY';
}

/** Everyone the user may see: admins all, department heads their department. */
export async function visibleEmployees(user: SessionUser, opts: { includeInactive?: boolean } = {}) {
  const all = await employees.all();
  return all
    .filter((e) => opts.includeInactive || e.active)
    .filter((e) => user.role === 'ADMIN' || e.department === user.department)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function employeeMap(): Promise<Map<string, Employee>> {
  return new Map((await employees.all()).map((e) => [e.id, e]));
}

/** Contract for the current school year. */
export async function currentContract(employeeId: string) {
  const year = await currentSchoolYear();
  if (!year) return undefined;
  return contracts.find((c) => c.employeeId === employeeId && c.schoolYearId === year.id);
}

/** PTO and maternity usage for the school year, read from posted absences. */
export async function absenceUsage(employeeId: string, schoolYearId: string) {
  const rows = await absences.where((a) => a.employeeId === employeeId && a.schoolYearId === schoolYearId);
  return { ...absenceUsageTotals(rows), rows };
}

/** One employee with handbook-derived benefits and PTO usage for the current school year. */
export async function getEmployeeBenefits(id: string) {
  const employee = await employees.get(id);
  if (!employee) return null;
  const year = await currentSchoolYear();
  const emp = employment(employee);
  const rules = benefitRules(emp);
  const usage = year ? await absenceUsage(id, year.id) : { ptoUsed: 0, maternityPaidUsed: 0 };
  const allowance = ptoAllowanceDays(emp);
  const weeks = maternityPaidWeeks(emp.yearsAtSchool);
  return {
    employee,
    rules,
    pto: { allowance, used: usage.ptoUsed, left: Math.max(0, allowance - usage.ptoUsed) },
    maternity: rules?.simchaAndMaternity
      ? { weeks, daysLeft: Math.max(0, weeks * emp.daysPerWeek - usage.maternityPaidUsed) }
      : null,
  };
}
export type EmployeeBenefits = NonNullable<Awaited<ReturnType<typeof getEmployeeBenefits>>>;
