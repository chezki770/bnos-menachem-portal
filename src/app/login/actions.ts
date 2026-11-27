'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { DUMMY_HASH, hashPassword, verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from '@/lib/auth/session';
import { consumeToken, createToken } from '@/lib/auth/tokens';
import { appUrl, sendEmail } from '@/lib/email';
import { allow } from '@/lib/rate-limit';
import { employees, type Employee } from '@/lib/store';

export type FormState = { error?: string; ok?: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}

async function startSession(user: Employee) {
  const token = await signSession({ id: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !process.env.APP_URL?.startsWith('http://'),
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

const credentials = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return { error: 'Enter your email and password.' };
  const ip = await clientIp();
  if (!allow(`login:${ip}`, 20) || !allow(`login:${parsed.data.email}`, 8))
    return { error: 'Too many attempts. Wait 15 minutes and try again.' };

  const user = await employees.find((e) => e.email.toLowerCase() === parsed.data.email);
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok || !user.active) return { error: 'Incorrect email or password.' };

  await startSession(user);
  await audit(user.id, 'LOGIN', 'Employee', user.id, ip);
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function requestReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = z.string().trim().toLowerCase().email().safeParse(form.get('email'));
  if (!email.success) return { error: 'Enter your email address.' };
  if (!allow(`reset:${await clientIp()}`, 5)) return { error: 'Too many requests. Try again later.' };
  const user = await employees.find((e) => e.email.toLowerCase() === email.data && e.active);
  if (user) {
    const token = await createToken(user.id, 'RESET');
    await sendEmail({
      to: user.email,
      subject: 'Reset your Bnos Menachem portal password',
      text: `Use this link within 2 hours to choose a new password:\n\n${appUrl(`/set-password/${token}`)}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
    await audit(user.id, 'PASSWORD_RESET_REQUESTED', 'Employee', user.id);
  }
  // Same answer either way, so the form doesn't reveal who has an account.
  return { ok: 'If that email has an account, a reset link is on its way.' };
}

const newPassword = z
  .object({
    token: z.string().min(10),
    password: z.string().min(10, 'Use at least 10 characters').max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ['confirm'] });

export async function setPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = newPassword.safeParse({
    token: form.get('token'),
    password: form.get('password'),
    confirm: form.get('confirm'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const t = await consumeToken(parsed.data.token);
  if (!t) return { error: 'This link has expired or was already used. Ask the office for a new one.' };
  const hash = await hashPassword(parsed.data.password);
  // Whole seconds, because session tokens record their issue time in seconds: the session started
  // just below stays valid, every older one (on any device) is signed out.
  const validFrom = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
  const user = await employees.update(t.employeeId, {
    passwordHash: hash,
    sessionsValidFrom: validFrom,
    updatedAt: new Date().toISOString(),
  });
  if (!user || !user.active) return { error: 'This account is not active.' };
  await audit(user.id, 'PASSWORD_SET', 'Employee', user.id);
  await startSession(user);
  redirect('/');
}
