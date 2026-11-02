import { db } from '@/lib/db';
import { benefitRules, maternityPaidWeeks, ptoAllowanceDays } from '@/lib/rules/benefits';

export async function listEmployees() {
  return db.employee.findMany({ orderBy: { name: 'asc' }, include: { contract: true } });
}

/** One employee with their handbook-derived benefits and PTO usage for the school year. */
export async function getEmployeeBenefits(id: string) {
  const employee = await db.employee.findUnique({
    where: { id },
    include: { contract: true, absences: true },
  });
  if (!employee) return null;

  const emp = {
    periodsPerWeek: employee.periodsPerWeek,
    yearsAtSchool: employee.yearsAtSchool,
    daysPerWeek: employee.daysPerWeek,
  };
  const rules = benefitRules(emp);
  const ptoUsed = employee.absences.reduce((sum, a) => sum + a.ptoDays, 0);
  const maternityUsed = employee.absences
    .filter((a) => a.type === 'MATERNITY')
    .reduce((sum, a) => sum + a.paidDays, 0);
  const allowance = ptoAllowanceDays(emp);

  return {
    employee,
    rules,
    pto: { allowance, used: ptoUsed, left: Math.max(0, allowance - ptoUsed) },
    maternity: rules?.simchaAndMaternity
      ? {
          weeks: maternityPaidWeeks(emp.yearsAtSchool),
          daysLeft: Math.max(0, maternityPaidWeeks(emp.yearsAtSchool) * emp.daysPerWeek - maternityUsed),
        }
      : null,
  };
}
