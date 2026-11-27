'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, safePath } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { assertAdmin, assertUser } from '@/lib/auth/current-user';
import { isHourly } from '@/lib/data/employees';
import { requireSchoolYear } from '@/lib/data/years';
import { appUrl, sendEmail } from '@/lib/email';
import { contracts, employees } from '@/lib/store';

/** Send (or re-send) this year's contract with the employee's current terms. Signed contracts are left alone. */
export async function sendContract(fd: FormData) {
  const actor = await assertAdmin();
  const employeeId = z.string().min(1).parse(fd.get('employeeId'));
  const returnTo = safePath(fd.get('returnTo'), '/contracts');
  const emp = await employees.get(employeeId);
  if (!emp) back(returnTo, 'Employee not found', 'error');
  const hourly = isHourly(emp);
  if (hourly ? emp.hourlyRateCents == null : emp.annualSalaryCents == null)
    back(
      returnTo,
      `Set ${emp.name}'s ${hourly ? 'hourly rate' : 'annual salary'} before sending a contract`,
      'error',
    );
  const year = await requireSchoolYear();
  const now = new Date().toISOString();
  const res = await contracts.mutate((rows) => {
    const existing = rows.find((c) => c.employeeId === emp.id && c.schoolYearId === year.id);
    if (existing?.status === 'SIGNED') return 'signed';
    const terms = {
      type: hourly ? ('HOURLY' as const) : ('FULL_YEAR' as const),
      status: 'SENT' as const,
      sentAt: now,
      remindedAt: null,
      handbookVersion: year.label,
      periodsPerWeek: emp.periodsPerWeek,
      annualSalaryCents: hourly ? null : emp.annualSalaryCents,
      hourlyRateCents: hourly ? emp.hourlyRateCents : null,
    };
    if (existing) Object.assign(existing, terms);
    else
      rows.push({
        id: crypto.randomUUID(),
        employeeId: emp.id,
        schoolYearId: year.id,
        signedAt: null,
        signedName: null,
        signedIp: null,
        ...terms,
      });
    return 'ok';
  });
  if (res === 'signed') back(returnTo, 'That contract is already signed', 'error');
  await sendEmail({
    to: emp.email,
    subject: `Your ${year.label} Bnos Menachem contract is ready to sign`,
    text: `Hi ${emp.knownAs ?? emp.name.split(' ')[0]},\n\nYour contract for ${year.label} is ready. Please review and sign it in the staff portal:\n\n${appUrl('/me/contract')}\n\nBnos Menachem office`,
  });
  await audit(actor.id, 'CONTRACT_SENT', 'Contract', emp.id, year.label);
  revalidatePath('/contracts');
  back(returnTo, `Contract sent to ${emp.name}`);
}

export async function remindContract(fd: FormData) {
  const actor = await assertAdmin();
  const id = z.string().min(1).parse(fd.get('contractId'));
  const returnTo = safePath(fd.get('returnTo'), '/contracts');
  const c = await contracts.get(id);
  const emp = c && (await employees.get(c.employeeId));
  if (!c || !emp || c.status !== 'SENT') back(returnTo, 'Nothing to remind', 'error');
  await contracts.update(c.id, { remindedAt: new Date().toISOString() });
  await sendEmail({
    to: emp.email,
    subject: 'Reminder: please sign your Bnos Menachem contract',
    text: `Hi ${emp.knownAs ?? emp.name.split(' ')[0]},\n\nA reminder that your contract is waiting for your signature. Pay can't be released until it's signed:\n\n${appUrl('/me/contract')}\n\nBnos Menachem office`,
  });
  await audit(actor.id, 'CONTRACT_REMINDED', 'Contract', c.id);
  back(returnTo, `Reminder sent to ${emp.name}`);
}

const signForm = z.object({
  contractId: z.string().min(1),
  signedName: z.string().trim().min(2, 'Type your full name to sign').max(120),
  agree: z.literal('on', { message: 'Check the box to agree' }),
});

/** The employee signs by typing their name and agreeing. Name, time and IP are recorded. */
export async function signContract(fd: FormData) {
  const user = await assertUser();
  const parsed = signForm.safeParse({
    contractId: fd.get('contractId'),
    signedName: fd.get('signedName'),
    agree: fd.get('agree'),
  });
  if (!parsed.success) back('/me/contract', parsed.error.issues[0]!.message, 'error');
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  if (norm(parsed.data.signedName) !== norm(user.name))
    back('/me/contract', `Type your name exactly as it appears: ${user.name}`, 'error');
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const res = await contracts.mutate((rows) => {
    const c = rows.find((r) => r.id === parsed.data.contractId);
    if (!c || c.employeeId !== user.id) return 'missing';
    if (c.status !== 'SENT') return 'state';
    Object.assign(c, {
      status: 'SIGNED',
      signedAt: new Date().toISOString(),
      signedName: parsed.data.signedName,
      signedIp: ip,
    });
    return 'ok';
  });
  if (res !== 'ok')
    back(
      '/me/contract',
      res === 'missing' ? 'Contract not found' : 'This contract is not waiting for a signature',
      'error',
    );
  await audit(user.id, 'CONTRACT_SIGNED', 'Contract', parsed.data.contractId);
  back('/me/contract', 'Thank you — your contract is signed.');
}
