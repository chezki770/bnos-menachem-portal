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
