import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { employees, type Employee, type Role } from '@/lib/store';
import { SESSION_COOKIE, verifySession } from './session';

export type SessionUser = { id: string; role: Role; name: string; department: string; email: string };

/** The signed-in employee, re-read from the data so deactivated people and role changes apply at once. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!token) return null;
  const emp = await employees.get(token.id);
  if (!emp || !emp.active) return null;
  return toSessionUser(emp);
}

export function toSessionUser(emp: Employee): SessionUser {
  return { id: emp.id, role: emp.role, name: emp.name, department: emp.department, email: emp.email };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/home');
  return user;
}

/** Admins and department heads. */
export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === 'STAFF') redirect('/home');
  return user;
}

export const isAdmin = (u: SessionUser) => u.role === 'ADMIN';
export const isManager = (u: SessionUser) => u.role === 'ADMIN' || u.role === 'DEPT_HEAD';

/** Admins see everyone; department heads see their own department. */
export function canManageEmployee(u: SessionUser, emp: Pick<Employee, 'department'>): boolean {
  return u.role === 'ADMIN' || (u.role === 'DEPT_HEAD' && emp.department === u.department);
}

/** Use inside server actions and route handlers, which can't redirect mid-mutation safely. */
export class AuthError extends Error {}
export async function assertUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError('Not signed in');
  return u;
}
export async function assertAdmin(): Promise<SessionUser> {
  const u = await assertUser();
  if (u.role !== 'ADMIN') throw new AuthError('Admins only');
  return u;
}
export async function assertManager(): Promise<SessionUser> {
  const u = await assertUser();
  if (u.role === 'STAFF') throw new AuthError('Managers only');
  return u;
}
