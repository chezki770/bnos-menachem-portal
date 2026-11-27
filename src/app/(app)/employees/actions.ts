'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { firstError, formObject } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { assertAdmin, assertUser, canManageEmployee } from '@/lib/auth/current-user';
import { createToken } from '@/lib/auth/tokens';
import { appUrl, sendEmail } from '@/lib/email';
import { employeeForm, SENSITIVE_FIELDS, type SensitiveField } from '@/lib/forms/employee';
import { departments, employees } from '@/lib/store';

export type ActionState = { error?: string; ok?: string; link?: string };

function toRow(d: z.infer<typeof employeeForm>) {
  const { hourlyRate, annualSalary, ...rest } = d;
  return { ...rest, hourlyRateCents: hourlyRate, annualSalaryCents: annualSalary };
}

export async function createEmployee(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const parsed = employeeForm.safeParse(formObject(fd, ['active']));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await departments.find((d) => d.name === parsed.data.department)))
    return { error: 'Unknown department' };
  const ts = new Date().toISOString();
  const result = await employees.mutate((rows) => {
    if (rows.some((r) => r.email.toLowerCase() === parsed.data.email)) return null;
    const row = {
      id: crypto.randomUUID(),
      ...toRow(parsed.data),
      passwordHash: null,
      gender: null,
      dateOfBirth: null,
      cellPhone: null,
      address: null,
      emergencyName: null,
      emergencyRelationship: null,
      emergencyPhone: null,
      createdAt: ts,
      updatedAt: ts,
      sessionsValidFrom: null,
    };
    rows.push(row);
    return row;
  });
  if (!result) return { error: 'Someone with that email already exists' };
  await audit(actor.id, 'EMPLOYEE_CREATED', 'Employee', result.id, result.name);
  redirect(
    `/employees/${result.id}?ok=${encodeURIComponent('Employee added. Send an invite so they can sign in.')}`,
  );
}

export async function updateEmployee(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const id = z.string().min(1).parse(fd.get('id'));
  const parsed = employeeForm.safeParse(formObject(fd, ['active']));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (id === actor.id && (parsed.data.role !== 'ADMIN' || !parsed.data.active))
    return { error: "You can't remove your own admin access" };
  const res = await employees.mutate((rows) => {
    if (rows.some((r) => r.id !== id && r.email.toLowerCase() === parsed.data.email)) return 'dup';
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return 'missing';
    rows[idx] = { ...rows[idx], ...toRow(parsed.data), updatedAt: new Date().toISOString() };
    return 'ok';
  });
  if (res === 'dup') return { error: 'Someone else already uses that email' };
  if (res === 'missing') return { error: 'Employee not found' };
  await audit(actor.id, 'EMPLOYEE_UPDATED', 'Employee', id);
  revalidatePath(`/employees/${id}`);
  return { ok: 'Saved' };
}

/** Creates a 7-day invite link, emails it, and returns it so the office can also share it directly. */
export async function sendInvite(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await assertAdmin();
  const emp = await employees.get(z.string().parse(fd.get('id')));
  if (!emp) return { error: 'Employee not found' };
  if (!emp.active) return { error: 'Reactivate this employee first' };
  const token = await createToken(emp.id, emp.passwordHash ? 'RESET' : 'INVITE');
  const link = appUrl(`/set-password/${token}`);
  const sent = await sendEmail({
    to: emp.email,
    subject: 'Your Bnos Menachem staff portal account',
    text: `Hi ${emp.knownAs ?? emp.name.split(' ')[0]},\n\nUse this link to set your password and sign in to the staff portal (valid for ${emp.passwordHash ? '2 hours' : '7 days'}):\n\n${link}\n\nBnos Menachem office`,
  });
  await audit(actor.id, emp.passwordHash ? 'RESET_LINK_SENT' : 'INVITE_SENT', 'Employee', emp.id);
  return {
    ok: sent ? `Emailed to ${emp.email}.` : 'Email is not set up, so copy this link and send it yourself:',
    link,
  };
}

/** Returns one sensitive field in plain text and records the read. Admins, or the employee themself. */
const revealInput = z.object({ employeeId: z.string().min(1).max(100), field: z.enum(SENSITIVE_FIELDS) });

export async function revealField(employeeIdArg: string, fieldArg: SensitiveField): Promise<string | null> {
  const user = await assertUser();
  // Server actions can be called directly with any arguments, so validate them like any other input.
  const parsed = revealInput.safeParse({ employeeId: employeeIdArg, field: fieldArg });
  if (!parsed.success) return null;
  const { employeeId, field } = parsed.data;
  const emp = await employees.get(employeeId);
  if (!emp) return null;
  if (user.id !== emp.id && !(user.role === 'ADMIN' && canManageEmployee(user, emp))) return null;
  await audit(user.id, 'VIEW_SENSITIVE', 'Employee', emp.id, field);
  return emp[field];
}
