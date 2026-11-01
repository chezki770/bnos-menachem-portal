import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateAbsence, schoolDays, SIMCHA_OCCASIONS } from '@/lib/rules/absences';

const body = z.object({
  employee: z.object({
    periodsPerWeek: z.number().int().min(0).max(60),
    yearsAtSchool: z.number().int().min(0).max(60),
    daysPerWeek: z.number().int().min(1).max(6),
  }),
  type: z.enum(['SICK', 'PERSONAL', 'SIMCHA', 'MATERNITY', 'SNOW_DAY', 'UNPAID']),
  occasion: z.enum(Object.keys(SIMCHA_OCCASIONS) as [keyof typeof SIMCHA_OCCASIONS]).optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adjacentToVacation: z.boolean().optional(),
  ptoUsedDays: z.number().min(0).default(0),
  maternityPaidUsedDays: z.number().min(0).default(0),
});

/** Preview what the handbook rules would do. Stateless for now; later it reads usage from the database. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  const { startsOn, endsOn, ...rest } = parsed.data;
  const days = schoolDays(startsOn, endsOn);
  const span = (Date.parse(endsOn) - Date.parse(startsOn)) / 864e5;
  return NextResponse.json(evaluateAbsence({ ...rest, days, calendarSpanDays: span }));
}
