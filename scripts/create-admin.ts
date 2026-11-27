/**
 * First-time setup on a new server: creates the first admin and prints a link to set their password.
 *   npm run create-admin -- "Full Name" email@school.org "Administration"
 */
import { createToken } from '@/lib/auth/tokens';
import { appUrl } from '@/lib/email';
import { departments, employees, schoolYears } from '@/lib/store';

async function main() {
  const [name, email, department = 'Administration'] = process.argv.slice(2);
  if (!name || !email || !email.includes('@')) {
    console.error('Usage: npm run create-admin -- "Full Name" email@school.org ["Department"]');
    process.exit(1);
  }
  if (!process.env.DATA_ENCRYPTION_KEY || !process.env.AUTH_SECRET)
    throw new Error('Set DATA_ENCRYPTION_KEY and AUTH_SECRET first');
  if (!(await departments.find((d) => d.name === department)))
    await departments.insert({ name: department, handbook: null });
  if (!(await schoolYears.all()).length) {
    const y = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    await schoolYears.insert({
      label: `${y}-${y + 1}`,
      startsOn: `${y}-09-01`,
      endsOn: `${y + 1}-06-30`,
      current: true,
    });
    console.log(`Created school year ${y}-${y + 1} (change it in Settings).`);
  }
  const lower = email.toLowerCase();
  let emp = await employees.find((e) => e.email.toLowerCase() === lower);
  const now = new Date().toISOString();
  if (emp) {
    emp = (await employees.update(emp.id, { role: 'ADMIN', active: true, updatedAt: now }))!;
    console.log(`${emp.name} is now an admin.`);
  } else {
    emp = await employees.insert({
      email: lower,
      name,
      knownAs: null,
      role: 'ADMIN',
      active: true,
      passwordHash: null,
      department,
      position: null,
      hiredOn: null,
      periodsPerWeek: 0,
      yearsAtSchool: 0,
      daysPerWeek: 5,
      hourlyRateCents: null,
      annualSalaryCents: null,
      gender: null,
      dateOfBirth: null,
      cellPhone: null,
      address: null,
      emergencyName: null,
      emergencyRelationship: null,
      emergencyPhone: null,
      createdAt: now,
      updatedAt: now,
      sessionsValidFrom: null,
    });
    console.log(`Created admin ${name} <${lower}>.`);
  }
  const token = await createToken(emp.id, emp.passwordHash ? 'RESET' : 'INVITE');
  console.log(`Set the password here (link works once):\n${appUrl(`/set-password/${token}`)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
