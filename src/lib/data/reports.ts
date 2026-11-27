import { benefitRules } from '@/lib/rules/benefits';
import { PAYROLL_STATUS_LABEL } from '@/lib/rules/payroll';
import { absences, contracts, employees, payPeriods, shifts } from '@/lib/store';
import { ABSENCE_LABEL, DOC_LABEL, fmtRange } from '@/lib/format';
import { documentsByEmployee, missingRequired, REQUIRED_DOCS } from './documents';
import { employment } from './employees';
import { buildRun } from './payroll';
import { mondayOf } from './shifts';
import { currentSchoolYear } from './years';

export type Report = { title: string; description: string; header: string[]; rows: (string | number)[][] };

const d = (c: number) => (c / 100).toFixed(2);

export const REPORTS = {
  directory: {
    title: 'Employee directory',
    description: 'Full roster with department, position, and contract status.',
  },
  payroll: { title: 'Payroll summary', description: 'Gross pay, adjustments, and totals by pay period.' },
  contracts: {
    title: 'Contract status',
    description: 'Signed, sent, and unsent contracts across all departments.',
  },
  absences: {
    title: 'Absence summary',
    description: 'Time-off by employee and type, for the current school year.',
  },
  coverage: { title: 'Shift coverage', description: 'Filled vs. open shifts by department and week.' },
  documents: {
    title: 'Document compliance',
    description: 'Required documents submitted vs. outstanding, by employee.',
  },
} as const;
export type ReportName = keyof typeof REPORTS;

export async function buildReport(name: ReportName): Promise<Report> {
  const meta = REPORTS[name];
  const year = await currentSchoolYear();
  const emps = (await employees.all()).filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name));
  const yearContracts = year ? await contracts.where((c) => c.schoolYearId === year.id) : [];
  const contractStatus = (id: string) => yearContracts.find((c) => c.employeeId === id)?.status ?? 'NOT_SENT';
  const label = { SIGNED: 'Signed', SENT: 'Sent — awaiting signature', NOT_SENT: 'Not sent' } as const;

  switch (name) {
    case 'directory':
      return {
        ...meta,
        header: ['Name', 'Email', 'Department', 'Position', 'Role', 'Periods/week', 'Pay basis', 'Contract'],
        rows: emps.map((e) => [
          e.name,
          e.email,
          e.department,
          e.position ?? '',
          e.role,
          e.periodsPerWeek,
          benefitRules(employment(e))?.basis === 'HOURLY' ? 'Hourly' : 'Salaried',
          label[contractStatus(e.id)],
        ]),
      };
    case 'contracts':
      return {
        ...meta,
        header: ['Name', 'Department', 'Type', 'Status', 'Sent', 'Signed'],
        rows: emps.map((e) => {
          const c = yearContracts.find((x) => x.employeeId === e.id);
          return [
            e.name,
            e.department,
            c?.type ?? '',
            label[contractStatus(e.id)],
            c?.sentAt?.slice(0, 10) ?? '',
            c?.signedAt?.slice(0, 10) ?? '',
          ];
        }),
      };
    case 'absences': {
      const rows = year ? await absences.where((a) => a.schoolYearId === year.id) : [];
      return {
        ...meta,
        header: [
          'Name',
          'Department',
          'Type',
          'Start',
          'End',
          'School days',
          'Paid',
          'PTO',
          'Docked',
          'Notes',
        ],
        rows: rows
          .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
          .map((a) => {
            const e = emps.find((x) => x.id === a.employeeId);
            return [
              e?.name ?? a.employeeId,
              e?.department ?? '',
              ABSENCE_LABEL[a.type],
              a.startsOn,
              a.endsOn,
              a.schoolDays,
              a.paidDays,
              a.ptoDays,
              a.dockedDays,
              a.notes ?? '',
            ];
          }),
      };
    }
    case 'documents': {
      const docs = await documentsByEmployee();
      return {
        ...meta,
        header: ['Name', 'Department', ...REQUIRED_DOCS.map((k) => DOC_LABEL[k]), 'Outstanding'],
        rows: emps.map((e) => {
          const have = docs.get(e.id);
          return [
            e.name,
            e.department,
            ...REQUIRED_DOCS.map((k) => (have?.has(k) ? 'Yes' : 'No')),
            missingRequired(have).length,
          ];
        }),
      };
    }
    case 'coverage': {
      const all = year ? await shifts.where((s) => s.date >= year.startsOn && s.date <= year.endsOn) : [];
      const groups = new Map<string, { filled: number; open: number }>();
      for (const s of all) {
        const key = `${mondayOf(s.date)}|${s.department}`;
        const g = groups.get(key) ?? { filled: 0, open: 0 };
        if (s.employeeId) g.filled++;
        else g.open++;
        groups.set(key, g);
      }
      return {
        ...meta,
        header: ['Week of', 'Department', 'Filled', 'Open', 'Coverage %'],
        rows: [...groups.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, g]) => {
            const [week, dept] = k.split('|');
            return [week, dept, g.filled, g.open, Math.round((100 * g.filled) / (g.filled + g.open))];
          }),
      };
    }
    case 'payroll': {
      const periods = year
        ? (
            await payPeriods.where(
              (p) => p.schoolYearId === year.id && p.startsOn <= new Date().toISOString().slice(0, 10),
            )
          ).sort((a, b) => a.startsOn.localeCompare(b.startsOn))
        : [];
      const rows: Report['rows'] = [];
      for (const p of periods) {
        const lines = await buildRun(p);
        const ready = lines.filter((l) => l.status === 'READY');
        const skipped = lines.filter((l) => l.status !== 'READY');
        rows.push([
          fmtRange(p.startsOn, p.endsOn),
          p.payDate,
          p.status,
          ready.length,
          d(ready.reduce((s, l) => s + l.grossCents, 0)),
          d(ready.reduce((s, l) => s + l.dockedCents, 0)),
          d(ready.reduce((s, l) => s + l.adjustmentsCents, 0)),
          d(ready.reduce((s, l) => s + l.totalCents, 0)),
          p.status === 'DRAFT'
            ? skipped.map((l) => `${l.employee.name} (${PAYROLL_STATUS_LABEL[l.status]})`).join('; ')
            : '',
        ]);
      }
      return {
        ...meta,
        header: [
          'Pay period',
          'Pay date',
          'Status',
          'Employees paid',
          'Gross',
          'Docked',
          'Adjustments',
          'Total before tax',
          'Skipped (draft only)',
        ],
        rows,
      };
    }
  }
}
