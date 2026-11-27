import { evaluateAbsence, schoolDays } from '@/lib/rules/absences';
import * as db from '@/lib/store';
import type { ImportOptions } from './csv-io';
import { employment } from './employees';

type Row = Record<string, unknown> & { id: string };

/** Per-table import settings: defaults for new rows and reference checks. */
export async function importOptions(
  table: db.TableName,
  actorId: string,
  mode: 'merge' | 'replace',
): Promise<ImportOptions> {
  const now = new Date().toISOString();
  const empIds = new Set((await db.employees.all()).map((e) => e.id));
  const periodIds = new Set((await db.payPeriods.all()).map((p) => p.id));
  const yearIds = new Set((await db.schoolYears.all()).map((y) => y.id));
  const deptNames = new Set((await db.departments.all()).map((d) => d.name));
  const needEmp = (r: Row, k = 'employeeId') =>
    r[k] && !empIds.has(String(r[k])) ? `${k} ${String(r[k])} is not an employee id` : null;

  switch (table) {
    case 'employees':
      return {
        mode,
        matchBy: 'email',
        defaults: {
          role: 'STAFF',
          active: 'true',
          periodsPerWeek: '0',
          yearsAtSchool: '0',
          daysPerWeek: '5',
          createdAt: now,
          updatedAt: now,
        },
        check: (r, all) => {
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r.email)))
            return `"${String(r.email)}" is not a valid email`;
          if (
            all.some((o) => o.id !== r.id && String(o.email).toLowerCase() === String(r.email).toLowerCase())
          )
            return `Email ${String(r.email)} is used twice`;
          if (deptNames.size && !deptNames.has(String(r.department)))
            return `Department "${String(r.department)}" doesn't exist (add it in Settings or import departments first)`;
          return null;
        },
      };
    case 'departments':
      return {
        mode,
        matchBy: 'name',
        check: (r, all) =>
          all.some((o) => o.id !== r.id && o.name === r.name)
            ? `Department ${String(r.name)} is listed twice`
            : null,
      };
    case 'school_years':
      return {
        mode,
        matchBy: 'label',
        defaults: { current: 'false' },
        check: (r) => (String(r.endsOn) <= String(r.startsOn) ? 'endsOn must be after startsOn' : null),
      };
    case 'absences':
      return {
        mode,
        defaults: {
          adjacentToVacation: 'false',
          postedById: actorId,
          createdAt: now,
          paidDays: '-1',
          ptoDays: '-1',
          dockedDays: '-1',
          schoolDays: '-1',
        },
        check: (r) =>
          needEmp(r) ??
          (!yearIds.has(String(r.schoolYearId))
            ? `schoolYearId ${String(r.schoolYearId)} doesn't exist`
            : String(r.endsOn) < String(r.startsOn)
              ? 'endsOn is before startsOn'
              : null),
      };
    case 'shifts':
      return {
        mode,
        defaults: { createdById: actorId },
        check: (r) =>
          needEmp(r) ?? (String(r.endTime) <= String(r.startTime) ? 'endTime must be after startTime' : null),
      };
    case 'shift_templates':
      return {
        mode,
        check: (r) =>
          needEmp(r) ??
          ((r.weekday as number) < 1 || (r.weekday as number) > 5
            ? 'weekday must be 1 (Mon) to 5 (Fri)'
            : null),
      };
    case 'time_entries':
      return {
        mode,
        defaults: { source: 'MANUAL', editedById: actorId },
        check: (r) =>
          needEmp(r) ??
          (r.clockOut && String(r.clockOut) <= String(r.clockIn) ? 'clockOut must be after clockIn' : null),
      };
    case 'pay_periods':
      return {
        mode,
        defaults: { status: 'DRAFT' },
        check: (r) =>
          !yearIds.has(String(r.schoolYearId))
            ? `schoolYearId ${String(r.schoolYearId)} doesn't exist`
            : String(r.endsOn) < String(r.startsOn)
              ? 'endsOn is before startsOn'
              : null,
      };
    case 'adjustments':
      return {
        mode,
        defaults: { createdById: actorId, createdAt: now },
        check: (r) =>
          needEmp(r) ??
          (!periodIds.has(String(r.payPeriodId))
            ? `payPeriodId ${String(r.payPeriodId)} doesn't exist`
            : (r.cents as number) <= 0
              ? 'cents must be positive'
              : null),
      };
    default:
      return { mode };
  }
}

/**
 * Imported absences without rule results (paidDays etc. left blank) are evaluated with the handbook
 * rules, in date order, so PTO usage builds up the same way as posting them one by one.
 */
export async function fillAbsenceResults(rows: Row[]): Promise<string | null> {
  const emps = new Map((await db.employees.all()).map((e) => [e.id, e]));
  const sorted = [...rows].sort((a, b) => String(a.startsOn).localeCompare(String(b.startsOn)));
  const used = new Map<string, { pto: number; mat: number }>();
  for (const r of sorted) {
    const key = `${String(r.employeeId)}|${String(r.schoolYearId)}`;
    const u = used.get(key) ?? { pto: 0, mat: 0 };
    if ((r.paidDays as number) < 0 || (r.ptoDays as number) < 0 || (r.dockedDays as number) < 0) {
      const e = emps.get(String(r.employeeId));
      if (!e) return `Unknown employee ${String(r.employeeId)}`;
      const days = schoolDays(String(r.startsOn), String(r.endsOn));
      const res = evaluateAbsence({
        employee: employment(e),
        type: r.type as db.AbsenceType,
        occasion: (r.occasion ?? undefined) as never,
        days,
        adjacentToVacation: !!r.adjacentToVacation,
        ptoUsedDays: u.pto,
        maternityPaidUsedDays: u.mat,
      });
      if (!res.ok) return `${e.name} ${String(r.startsOn)}: ${res.error}`;
      Object.assign(r, {
        schoolDays: days,
        paidDays: res.paidDays,
        ptoDays: res.ptoDays,
        dockedDays: res.dockedDays,
        notes: r.notes ?? (res.notes.join('; ') || null),
      });
    } else if ((r.schoolDays as number) < 0) {
      r.schoolDays = schoolDays(String(r.startsOn), String(r.endsOn));
    }
    u.pto += r.ptoDays as number;
    if (r.type === 'MATERNITY') u.mat += r.paidDays as number;
    used.set(key, u);
  }
  return null;
}

/**
 * Replace mode deletes rows that aren't in the file. Refuse when other tables still point at them
 * (e.g. removing an employee who has contracts or payroll history), instead of leaving orphans.
 */
export async function referencesToRemoved(table: db.TableName, removed: Row[]): Promise<string[]> {
  if (!removed.length) return [];
  const ids = new Set(removed.map((r) => r.id));
  const label = (r: Row) => String(r.name ?? r.label ?? r.email ?? r.id);
  const problems: string[] = [];
  const check = async (rows: Record<string, unknown>[], key: string, what: string, match: Set<string> = ids) => {
    const hits = new Map<string, number>();
    for (const r of rows) {
      const v = r[key];
      if (typeof v === 'string' && match.has(v)) hits.set(v, (hits.get(v) ?? 0) + 1);
    }
    for (const [v, n] of hits) {
      const row = removed.find((r) => r.id === v || r.name === v);
      problems.push(`Can't remove ${row ? label(row) : v}: ${n} ${what} still refer to it`);
    }
  };
  switch (table) {
    case 'employees':
      await check(await db.contracts.all(), 'employeeId', 'contract(s)');
      await check(await db.documents.all(), 'employeeId', 'document(s)');
      await check(await db.absences.all(), 'employeeId', 'absence(s)');
      await check(await db.timeOffRequests.all(), 'employeeId', 'time-off request(s)');
      await check(await db.timeEntries.all(), 'employeeId', 'time clock entr(ies)');
      await check(await db.timeCards.all(), 'employeeId', 'time card(s)');
      await check(await db.adjustments.all(), 'employeeId', 'pay adjustment(s)');
      await check(await db.payrollLines.all(), 'employeeId', 'submitted payroll line(s)');
      await check(await db.shifts.all(), 'employeeId', 'shift(s)');
      await check(await db.shiftTemplates.all(), 'employeeId', 'shift template row(s)');
      break;
    case 'school_years':
      await check(await db.payPeriods.all(), 'schoolYearId', 'pay period(s)');
      await check(await db.contracts.all(), 'schoolYearId', 'contract(s)');
      await check(await db.absences.all(), 'schoolYearId', 'absence(s)');
      break;
    case 'pay_periods':
      await check(await db.adjustments.all(), 'payPeriodId', 'pay adjustment(s)');
      await check(await db.payrollLines.all(), 'payPeriodId', 'submitted payroll line(s)');
      await check(await db.timeCards.all(), 'payPeriodId', 'time card(s)');
      break;
    case 'departments': {
      const names = new Set(removed.map((r) => String(r.name)));
      await check(await db.employees.all(), 'department', 'employee(s)', names);
      await check(await db.shifts.all(), 'department', 'shift(s)', names);
      await check(await db.shiftTemplates.all(), 'department', 'shift template row(s)', names);
      break;
    }
  }
  return problems.slice(0, 20);
}
