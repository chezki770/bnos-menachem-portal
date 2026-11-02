/**
 * Local development seed. The demo people and the shared dev password below are
 * for your own machine only: never run this against a real database.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const DEV_PASSWORD = process.env.SEED_PASSWORD ?? 'bnos-dev-password';

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
    contract: 'SIGNED',
  },
  {
    name: 'Alex Morgan',
    email: 'amorgan@example.org',
    role: 'STAFF',
    department: 'Judaic Studies',
    position: 'Teacher',
    periodsPerWeek: 16,
    yearsAtSchool: 5,
    daysPerWeek: 5,
    contract: 'SIGNED',
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
    contract: 'SENT',
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
    contract: 'NOT_SENT',
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
    contract: 'SIGNED',
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
    contract: 'SIGNED',
  },
] as const;

async function main() {
  const year = await db.schoolYear.upsert({
    where: { label: '2026-2027' },
    update: {},
    create: { label: '2026-2027', startsOn: new Date('2026-09-01'), endsOn: new Date('2027-06-30') },
  });
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  for (const { contract, ...p } of people) {
    const employee = await db.employee.upsert({
      where: { email: p.email },
      update: { ...p, passwordHash, schoolYearId: year.id },
      create: { ...p, passwordHash, schoolYearId: year.id },
    });
    await db.contract.upsert({
      where: { employeeId: employee.id },
      update: { status: contract },
      create: { employeeId: employee.id, status: contract },
    });
  }
  console.log(
    `Seeded ${people.length} people. Sign in as jreyes@example.org (admin) or tbrooks@example.org (staff).`,
  );
  console.log(`Dev password: ${DEV_PASSWORD}`);
}

main().finally(() => db.$disconnect());
