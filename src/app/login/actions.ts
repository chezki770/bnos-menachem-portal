'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { DUMMY_HASH, verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

const credentials = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return { error: 'Enter your email and password.' };

  const user = await db.employee.findUnique({ where: { email: parsed.data.email } });
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) return { error: 'Incorrect email or password.' };

  const token = await signSession({ id: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: 'LOGIN', entity: 'Employee', entityId: user.id },
  });
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
