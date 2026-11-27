/**
 * Local demo data. Writes CSV files into DATA_DIR (default ./data).
 * The demo people and shared dev password are for your own machine only.
 *   npm run seed            # refuses if data already exists
 *   npm run seed -- --force # wipes the demo tables and re-creates them
 */
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { evaluateAbsence, schoolDays } from '@/lib/rules/absences';
import { semiMonthlyPeriods } from '@/lib/rules/payroll';
import { addDays, todayIso } from '@/lib/format';
import { saveEncryptedFile } from '@/lib/data/files';
import { buildRun } from '@/lib/data/payroll';
import * as db from '@/lib/store';
import { dataDir } from '@/lib/store/table';

const DEV_PASSWORD = process.env.SEED_PASSWORD ?? 'bnos-dev-password';
const now = () => new Date().toISOString();

async function main() {
  if (!process.env.DATA_ENCRYPTION_KEY)
    throw new Error('Set DATA_ENCRYPTION_KEY in .env first (see .env.example)');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production');
  const force = process.argv.includes('--force');
  if (existsSync(db.employees.file) && !force) {
    console.error(
      `Data already exists in ${dataDir()}. Run "npm run seed -- --force" to replace it with demo data.`,
    );
    process.exit(1);
  }
  if (force) await rm(dataDir(), { recursive: true, force: true });

  const year = await db.schoolYears.insert({
    label: '2026-2027',
    startsOn: '2026-09-01',
    endsOn: '2027-06-30',
    current: true,
  });
  for (const [name, handbook] of [
    ['Administration', 'High School'],
    ['Elementary', 'Elementary'],
    ['Facilities', 'High School'],
    ['High School', 'High School'],
    ['Judaic Studies', 'High School'],
    ['Math', 'High School'],
  ])
    await db.departments.insert({ name, handbook });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
  const people = [
    {
      name: 'Jordan Reyes',
      email: 'jreyes@example.org',
      role: 'ADMIN',
      department: 'Administration',
      position: 'Office Manager',
      periodsPerWeek: 20,
      yearsAtSchool: 11,
      daysPerWeek: 5,
      annualSalaryCents: 6_200_000,
      hourlyRateCents: null,
      contract: 'SIGNED',
      docs: 'all',
    },
    {
      name: 'Alex Morgan',
      email: 'amorgan@example.org',
      role: 'DEPT_HEAD',
      department: 'Judaic Studies',
      position: 'Teacher',
      periodsPerWeek: 16,
      yearsAtSchool: 5,
      daysPerWeek: 5,
      annualSalaryCents: 5_400_000,
      hourlyRateCents: null,
      contract: 'SIGNED',
      docs: 'all',
    },
    {
      name: 'Taylor Brooks',
      email: 'tbrooks@example.org',
      role: 'STAFF',
      department: 'Elementary',
      position: 'Teacher',
      periodsPerWeek: 12,
      yearsAtSchool: 2,
      daysPerWeek: 4,
      annualSalaryCents: 3_600_000,
      hourlyRateCents: null,
      contract: 'SENT',
      docs: 'some',
    },
    {
      name: 'Sam Whitfield',
      email: 'swhitfield@example.org',
      role: 'STAFF',
      department: 'Facilities',
      position: 'Custodian',
      periodsPerWeek: 6,
      yearsAtSchool: 1,
      daysPerWeek: 5,
      annualSalaryCents: null,
      hourlyRateCents: 2200,
      contract: 'NOT_SENT',
      docs: 'none',
    },
    {
      name: 'Casey Lin',
      email: 'clin@example.org',
      role: 'STAFF',
      department: 'Elementary',
      position: "Teacher's Aide",
      periodsPerWeek: 8,
      yearsAtSchool: 3,
      daysPerWeek: 5,
      annualSalaryCents: null,
      hourlyRateCents: 2000,
      contract: 'SIGNED',
      docs: 'all',
    },
    {
      name: 'Morgan Ellis',
      email: 'mellis@example.org',
      role: 'STAFF',
      department: 'High School',
      position: 'Teacher',
      periodsPerWeek: 12,
      yearsAtSchool: 10,
      daysPerWeek: 4,
      annualSalaryCents: 4_800_000,
      hourlyRateCents: null,
      contract: 'SIGNED',
      docs: 'all',
    },
  ] as const;

  const ids: Record<string, string> = {};
  const pdf = Buffer.from('%PDF-1.4\n% demo document\n%%EOF\n');
  for (const p of people) {
    const e = await db.employees.insert({
      email: p.email,
      name: p.name,
      knownAs: null,
      role: p.role,
      active: true,
      passwordHash,
      department: p.department,
      position: p.position,
      hiredOn: `${2026 - p.yearsAtSchool}-08-20`,
      periodsPerWeek: p.periodsPerWeek,
      yearsAtSchool: p.yearsAtSchool,
      daysPerWeek: p.daysPerWeek,
      hourlyRateCents: p.hourlyRateCents,
      annualSalaryCents: p.annualSalaryCents,
      gender: null,
      dateOfBirth: '1990-04-02',
      cellPhone: '(555) 010-0142',
      address: '123 Maple St, Springfield',
      emergencyName: null,
      emergencyRelationship: null,
      emergencyPhone: null,
      createdAt: now(),
      updatedAt: now(),
    });
    ids[p.name] = e.id;
    await db.contracts.insert({
      employeeId: e.id,
      schoolYearId: year.id,
      type: p.hourlyRateCents ? 'HOURLY' : 'FULL_YEAR',
      status: p.contract,
      sentAt: p.contract === 'NOT_SENT' ? null : '2026-08-15T14:00:00.000Z',
      remindedAt: null,
      signedAt: p.contract === 'SIGNED' ? '2026-08-20T15:00:00.000Z' : null,
      signedName: p.contract === 'SIGNED' ? p.name : null,
      signedIp: null,
      handbookVersion: '2026-2027',
      periodsPerWeek: p.periodsPerWeek,
      annualSalaryCents: p.annualSalaryCents,
      hourlyRateCents: p.hourlyRateCents,
      employeeName: p.name,
      position: p.position,
      department: p.department,
      daysPerWeek: p.daysPerWeek,
      yearsAtSchool: p.yearsAtSchool,
    });
    const kinds =
      p.docs === 'all'
        ? db.DOCUMENT_KINDS.filter((k) => k !== 'OTHER')
        : p.docs === 'some'
          ? (['W4', 'ID', 'IT2104'] as const)
          : [];
    for (const kind of kinds)
      await db.documents.insert({
        employeeId: e.id,
        kind,
        fileKey: await saveEncryptedFile(pdf),
        fileName: `${kind.toLowerCase()}.pdf`,
        mimeType: 'application/pdf',
        size: pdf.length,
        uploadedAt: '2026-08-12T13:00:00.000Z',
        uploadedById: e.id,
      });
  }
  const admin = ids['Jordan Reyes'];

  // Pay periods; the ones already over are marked paid.
  const today = todayIso();
  for (const p of semiMonthlyPeriods(year.startsOn, year.endsOn))
    await db.payPeriods.insert({
      schoolYearId: year.id,
      ...p,
      status: 'DRAFT',
      submittedAt: null,
      submittedById: null,
    });

  // Shifts: this week and next, following the mockup's pattern.
  const wd = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = addDays(today, wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd);
  const pattern: [number, string, string, string, string | null, string | null][] = [
    [0, '08:00', '15:30', 'Judaic Studies', 'Alex Morgan', null],
    [0, '08:00', '15:30', 'Elementary', 'Taylor Brooks', null],
    [0, '15:30', '17:00', 'High School', null, 'Coverage needed — after-school'],
    [1, '08:00', '12:00', 'Math', null, 'Unfilled — new position'],
    [1, '08:00', '15:30', 'Elementary', 'Casey Lin', null],
    [1, '08:00', '15:30', 'Elementary', 'Taylor Brooks', null],
    [2, '08:00', '15:30', 'High School', 'Morgan Ellis', null],
    [3, '08:00', '15:30', 'Judaic Studies', 'Alex Morgan', null],
    [3, '08:00', '15:30', 'Elementary', 'Taylor Brooks', null],
    [3, '13:00', '15:30', 'Facilities', null, 'S. Whitfield — approved time off'],
    [4, '08:00', '12:00', 'Elementary', 'Taylor Brooks', null],
    [4, '12:00', '15:30', 'Elementary', null, 'Unfilled — new position'],
  ];
  for (const week of [0, 7])
    for (const [d, s, e, dept, who, reason] of pattern)
      await db.shifts.insert({
        date: addDays(monday, week + d),
        startTime: s,
        endTime: e,
        department: dept,
        employeeId: who ? ids[who] : null,
        reason,
        createdById: admin,
      });
  for (const [d, s, e, dept, who] of pattern.filter((p) => p[4]))
    await db.shiftTemplates.insert({
      template: 'Standard week',
      weekday: d + 1,
      startTime: s,
      endTime: e,
      department: dept,
      employeeId: ids[who!],
    });

  // Time clock for hourly staff: weekdays of the last three weeks.
  for (const name of ['Casey Lin', 'Sam Whitfield']) {
    for (let i = 21; i >= 1; i--) {
      const day = addDays(today, -i);
      const w = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (w === 0 || w === 6) continue;
      const hours = name === 'Casey Lin' ? 7.5 : 5;
      const start = new Date(`${day}T08:00:00-05:00`);
      await db.timeEntries.insert({
        employeeId: ids[name],
        clockIn: start.toISOString(),
        clockOut: new Date(start.getTime() + hours * 3600_000).toISOString(),
        source: 'CLOCK',
        note: null,
        editedById: null,
      });
    }
  }
  const current = (await db.payPeriods.all()).find((p) => p.startsOn <= today && today <= p.endsOn);
  if (current)
    await db.timeCards.insert({
      employeeId: ids['Casey Lin'],
      payPeriodId: current.id,
      status: 'SUBMITTED',
      submittedAt: now(),
      decidedById: null,
      decidedAt: null,
      note: null,
      approvedRegularHours: null,
      approvedOvertimeHours: null,
    });

  // Absences, evaluated by the handbook rules like the portal does.
  for (const [name, type, s, e] of [
    ['Casey Lin', 'SICK', '2026-09-04', '2026-09-04'],
    ['Sam Whitfield', 'PERSONAL', '2026-09-02', '2026-09-03'],
    ['Morgan Ellis', 'SICK', '2026-10-14', '2026-10-15'],
  ] as const) {
    const emp = people.find((p) => p.name === name)!;
    const days = schoolDays(s, e);
    const r = evaluateAbsence({ employee: emp, type, days, ptoUsedDays: 0 });
    if (!r.ok) throw new Error(r.error);
    await db.absences.insert({
      employeeId: ids[name],
      schoolYearId: year.id,
      type,
      occasion: null,
      startsOn: s,
      endsOn: e,
      schoolDays: days,
      adjacentToVacation: false,
      paidDays: r.paidDays,
      ptoDays: r.ptoDays,
      dockedDays: r.dockedDays,
      notes: r.notes.join('; ') || null,
      postedById: admin,
      requestId: null,
      createdAt: now(),
    });
  }
  await db.timeOffRequests.insert({
    employeeId: ids['Taylor Brooks'],
    type: 'PERSONAL',
    occasion: null,
    startsOn: addDays(monday, 9),
    endsOn: addDays(monday, 9),
    adjacentToVacation: false,
    note: 'Family appointment',
    status: 'PENDING',
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: now(),
  });
  if (current)
    await db.adjustments.insert({
      payPeriodId: current.id,
      employeeId: ids['Morgan Ellis'],
      kind: 'REIMBURSEMENT',
      cents: 4500,
      note: 'Classroom supplies',
      createdById: admin,
      createdAt: now(),
    });

  // Past periods: freeze the run like "Submit run" does, then mark paid.
  for (const p of (await db.payPeriods.all()).filter((x) => x.payDate < today)) {
    for (const l of (await buildRun(p)).filter((x) => x.status === 'READY'))
      await db.payrollLines.insert({
        payPeriodId: p.id,
        employeeId: l.employee.id,
        basis: l.basis,
        regularHours: l.regularHours,
        overtimeHours: l.overtimeHours,
        dockedDays: l.dockedDays,
        grossCents: l.grossCents,
        dockedCents: l.dockedCents,
        adjustmentsCents: l.adjustmentsCents,
        totalCents: l.totalCents,
        hourlyRateCents: l.hourlyRateCents,
        bonusCents: l.bonusCents,
        reimbursementCents: l.reimbursementCents,
        deductionCents: l.deductionCents,
      });
    await db.payPeriods.update(p.id, {
      status: 'PAID',
      submittedAt: `${p.endsOn}T17:00:00.000Z`,
      submittedById: admin,
    });
  }

  await db.auditLog.append({
    at: now(),
    actorId: admin,
    action: 'SEEDED',
    entity: 'Portal',
    entityId: null,
    detail: 'Demo data',
  });
  console.log(`Seeded demo data into ${path.relative(process.cwd(), dataDir()) || '.'}/`);
  console.log(
    'Sign in as jreyes@example.org (admin), amorgan@example.org (department head) or tbrooks@example.org (staff).',
  );
  console.log(`Dev password: ${DEV_PASSWORD}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
