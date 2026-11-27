import { NextResponse } from 'next/server';
import { canManageEmployee, getSessionUser } from '@/lib/auth/current-user';
import { absenceInput, evaluateFor } from '@/lib/data/absences';
import { currentSchoolYear } from '@/lib/data/years';
import { employees } from '@/lib/store';

/** What the handbook rules would do for an absence, using the PTO already used this school year. Nothing is saved. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
  const parsed = absenceInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  const emp = await employees.get(parsed.data.employeeId);
  if (!emp || !(emp.id === user.id || canManageEmployee(user, emp)))
    return NextResponse.json({ ok: false, error: 'Employee not found' }, { status: 404 });
  const year = await currentSchoolYear();
  if (!year) return NextResponse.json({ ok: false, error: 'No school year set up' }, { status: 400 });
  return NextResponse.json(await evaluateFor(emp, parsed.data, year.id));
}
