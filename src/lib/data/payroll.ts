import {
  adjustmentsTotalCents,
  dockedCents,
  dockedDaysInRange,
  hourlyGrossCents,
  payrollStatus,
  round2,
  salariedPeriodGrossCents,
  workdaysInYear,
  type PayrollStatus,
} from '@/lib/rules/payroll';
import {
  absences,
  adjustments,
  contracts,
  employees,
  payPeriods,
  payrollLines,
  schoolYears,
  type Adjustment,
  type Employee,
  type PayPeriod,
} from '@/lib/store';
import { documentsByEmployee } from './documents';
import { isHourly } from './employees';
import { timeCardSummary } from './time';

export type RunLine = {
  employee: Employee;
  basis: 'HOURLY' | 'SALARIED';
  regularHours: number;
  overtimeHours: number;
  dockedDays: number;
  grossCents: number;
  dockedCents: number;
  adjustmentsCents: number;
  totalCents: number;
  status: PayrollStatus;
  timeCardStatus: string; // MISSING | SUBMITTED | APPROVED | NEEDS_CHANGES | CHANGED | n/a
  /** Live adjustment rows (for listing). Exports use the amounts below, which are frozen once submitted. */
  adjustments: Adjustment[];
  hourlyRateCents: number | null;
  bonusCents: number;
  reimbursementCents: number;
  deductionCents: number;
};

const sumKind = (adjs: Adjustment[], kind: Adjustment['kind']) =>
  adjs.filter((a) => a.kind === kind).reduce((s, a) => s + a.cents, 0);

export async function periodsForYear(schoolYearId: string): Promise<PayPeriod[]> {
  return (await payPeriods.where((p) => p.schoolYearId === schoolYearId)).sort((a, b) =>
    a.startsOn.localeCompare(b.startsOn),
  );
}

/** Builds the run for a pay period from current data (draft), or from the stored snapshot once submitted. */
export async function buildRun(period: PayPeriod): Promise<RunLine[]> {
  const year = await schoolYears.get(period.schoolYearId);
  const periodCount = (await periodsForYear(period.schoolYearId)).length;
  const docs = await documentsByEmployee();
  const allAdj = await adjustments.where((a) => a.payPeriodId === period.id);
  const yearContracts = await contracts.where((c) => c.schoolYearId === period.schoolYearId);
  // Absences that overlap the period, including ones that started in an earlier period.
  const periodAbsences = await absences.where(
    (a) => a.startsOn <= period.endsOn && a.endsOn >= period.startsOn,
  );
  const snapshot =
    period.status === 'DRAFT' ? null : await payrollLines.where((l) => l.payPeriodId === period.id);
  const emps = (await employees.all())
    .filter((e) => e.active || snapshot?.some((l) => l.employeeId === e.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lines: RunLine[] = [];
  for (const emp of emps) {
    const adjs = allAdj.filter((a) => a.employeeId === emp.id);
    const saved = snapshot?.find((l) => l.employeeId === emp.id);
    const hourly = isHourly(emp);
    const tc = hourly ? await timeCardSummary(emp.id, period) : null;
    const timeCardStatus = hourly ? tc!.status : 'n/a';
    const signed = yearContracts.some((c) => c.employeeId === emp.id && c.status === 'SIGNED');
    const status = payrollStatus({
      contractSigned: signed,
      hasDirectDeposit: docs.get(emp.id)?.has('DIRECT_DEPOSIT') ?? false,
      hourly,
      timeCardApproved: !!tc?.approvalValid,
      hasPayRate: hourly ? emp.hourlyRateCents != null : emp.annualSalaryCents != null,
    });

    if (snapshot) {
      if (!saved) continue; // was skipped in the submitted run
      lines.push({
        employee: emp,
        basis: saved.basis,
        regularHours: saved.regularHours,
        overtimeHours: saved.overtimeHours,
        dockedDays: saved.dockedDays,
        grossCents: saved.grossCents,
        dockedCents: saved.dockedCents,
        adjustmentsCents: saved.adjustmentsCents,
        totalCents: saved.totalCents,
        status: 'READY',
        timeCardStatus,
        adjustments: adjs,
        // Older snapshots without these columns fall back to current values.
        hourlyRateCents: saved.basis === 'HOURLY' ? (saved.hourlyRateCents ?? emp.hourlyRateCents) : null,
        bonusCents: saved.bonusCents ?? sumKind(adjs, 'BONUS'),
        reimbursementCents: saved.reimbursementCents ?? sumKind(adjs, 'REIMBURSEMENT'),
        deductionCents: saved.deductionCents ?? sumKind(adjs, 'DEDUCTION'),
      });
      continue;
    }

    const docked = round2(
      periodAbsences
        .filter((a) => a.employeeId === emp.id)
        .reduce((s, a) => s + dockedDaysInRange(a, period.startsOn, period.endsOn), 0),
    );
    let gross = 0;
    let dockCents = 0;
    if (hourly) {
      gross = hourlyGrossCents(emp.hourlyRateCents ?? 0, tc!.regular, tc!.overtime);
    } else if (emp.annualSalaryCents != null && year) {
      gross = salariedPeriodGrossCents(emp.annualSalaryCents, periodCount);
      dockCents = dockedCents(
        emp.annualSalaryCents,
        workdaysInYear(year.startsOn, year.endsOn, emp.daysPerWeek),
        docked,
      );
    }
    const adjCents = adjustmentsTotalCents(adjs);
    lines.push({
      employee: emp,
      basis: hourly ? 'HOURLY' : 'SALARIED',
      regularHours: tc?.regular ?? 0,
      overtimeHours: tc?.overtime ?? 0,
      dockedDays: hourly ? 0 : docked,
      grossCents: gross,
      dockedCents: dockCents,
      adjustmentsCents: adjCents,
      totalCents: gross - dockCents + adjCents,
      status,
      timeCardStatus,
      adjustments: adjs,
      hourlyRateCents: hourly ? emp.hourlyRateCents : null,
      bonusCents: sumKind(adjs, 'BONUS'),
      reimbursementCents: sumKind(adjs, 'REIMBURSEMENT'),
      deductionCents: sumKind(adjs, 'DEDUCTION'),
    });
  }
  return lines;
}

/** CSV rows for the payroll provider. Only READY lines are included. */
export function providerExport(period: PayPeriod, lines: RunLine[]): string[][] {
  const header = [
    'employee_id',
    'name',
    'email',
    'department',
    'pay_period_start',
    'pay_period_end',
    'pay_date',
    'basis',
    'hourly_rate',
    'regular_hours',
    'overtime_hours',
    'gross',
    'docked_days',
    'docked_amount',
    'bonus',
    'reimbursement',
    'deduction',
    'total_before_tax',
  ];
  const d = (c: number) => (c / 100).toFixed(2);
  return [
    header,
    ...lines
      .filter((l) => l.status === 'READY')
      .map((l) => [
        l.employee.id,
        l.employee.name,
        l.employee.email,
        l.employee.department,
        period.startsOn,
        period.endsOn,
        period.payDate,
        l.basis,
        l.basis === 'HOURLY' ? d(l.hourlyRateCents ?? 0) : '',
        String(l.regularHours),
        String(l.overtimeHours),
        d(l.grossCents),
        String(l.dockedDays),
        d(l.dockedCents),
        d(l.bonusCents),
        d(l.reimbursementCents),
        d(l.deductionCents),
        d(l.totalCents),
      ]),
  ];
}
