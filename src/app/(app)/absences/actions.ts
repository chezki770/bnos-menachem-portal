'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, firstError, formObject, safePath } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { assertAdmin, assertManager, canManageEmployee } from '@/lib/auth/current-user';
import { absenceInput, postAbsence } from '@/lib/data/absences';
import { sendEmail, appUrl } from '@/lib/email';
import { ABSENCE_LABEL, fmtRange } from '@/lib/format';
import { absences, employees, timeOffRequests } from '@/lib/store';

export type PostState = { error?: string; ok?: string };

export async function postAbsenceAction(_prev: PostState, fd: FormData): Promise<PostState> {
  const actor = await assertManager();
  const parsed = absenceInput.safeParse(formObject(fd, ['adjacentToVacation']));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const emp = await employees.get(parsed.data.employeeId);
  if (!emp || !canManageEmployee(actor, emp)) return { error: 'Employee not found' };
  const res = await postAbsence(actor.id, parsed.data);
  if (!res.ok) return { error: res.error };
  revalidatePath('/absences');
  return { ok: `Absence saved for ${emp.name}` };
}

const decision = z.object({
  requestId: z.string().min(1),
  decision: z.enum(['APPROVED', 'DECLINED']),
  note: z.string().trim().max(500).optional(),
});

/** Approving a request posts the absence through the handbook rules; declining just records the decision. */
export async function decideRequest(fd: FormData) {
  const actor = await assertManager();
  const parsed = decision.safeParse(formObject(fd));
  if (!parsed.success) back('/absences', firstError(parsed.error), 'error');
  const req = await timeOffRequests.get(parsed.data.requestId);
  const emp = req && (await employees.get(req.employeeId));
  if (!req || !emp || !canManageEmployee(actor, emp)) back('/absences', 'Request not found', 'error');
  if (req.status !== 'PENDING') back('/absences', 'That request was already decided', 'error');
  if (emp.id === actor.id) back('/absences', "You can't approve your own request", 'error');

  if (parsed.data.decision === 'APPROVED') {
    const res = await postAbsence(
      actor.id,
      {
        employeeId: emp.id,
        type: req.type,
        occasion: (req.occasion ?? undefined) as never,
        startsOn: req.startsOn,
        endsOn: req.endsOn,
        adjacentToVacation: req.adjacentToVacation,
      },
      req.id,
    );
    if (!res.ok) back('/absences', `Couldn't approve: ${res.error}`, 'error');
  }
  await timeOffRequests.update(req.id, {
    status: parsed.data.decision,
    decidedById: actor.id,
    decidedAt: new Date().toISOString(),
    decisionNote: parsed.data.note || null,
  });
  await audit(actor.id, `REQUEST_${parsed.data.decision}`, 'TimeOffRequest', req.id, emp.name);
  await sendEmail({
    to: emp.email,
    subject: `Time off ${parsed.data.decision === 'APPROVED' ? 'approved' : 'declined'}: ${fmtRange(req.startsOn, req.endsOn)}`,
    text: `Your ${ABSENCE_LABEL[req.type].toLowerCase()} request for ${fmtRange(req.startsOn, req.endsOn)} was ${parsed.data.decision === 'APPROVED' ? 'approved' : 'declined'}.${parsed.data.note ? `\n\nNote: ${parsed.data.note}` : ''}\n\n${appUrl('/me/time-off')}`,
  });
  revalidatePath('/absences');
  back(
    '/absences',
    `Request ${parsed.data.decision === 'APPROVED' ? 'approved and absence posted' : 'declined'}`,
  );
}

export async function deleteAbsence(fd: FormData) {
  const actor = await assertAdmin();
  const id = z.string().min(1).parse(fd.get('id'));
  const returnTo = safePath(fd.get('returnTo'), '/absences');
  const row = await absences.get(id);
  if (!row) back(returnTo, 'Absence not found', 'error');
  await absences.remove(id);
  if (row.requestId) await timeOffRequests.update(row.requestId, { status: 'CANCELLED' });
  await audit(
    actor.id,
    'ABSENCE_DELETED',
    'Absence',
    id,
    `${row.employeeId} ${row.type} ${row.startsOn}–${row.endsOn}`,
  );
  back(returnTo, 'Absence removed; PTO usage updated');
}
