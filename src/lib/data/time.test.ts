import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { zonedToUtcIso } from '@/lib/format';
import { timeCards, timeEntries, type PayPeriod } from '@/lib/store';
import { timeCardSummary } from './time';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'bnos-time-'));
  process.env.DATA_DIR = dir;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const period: PayPeriod = {
  id: 'p1',
  schoolYearId: 'y1',
  startsOn: '2026-09-16',
  endsOn: '2026-09-30',
  payDate: '2026-10-03',
  status: 'DRAFT',
  submittedAt: null,
  submittedById: null,
};
const punch = (date: string, from: string, to: string, toDate = date) =>
  timeEntries.insert({
    employeeId: 'e1',
    clockIn: zonedToUtcIso(date, from),
    clockOut: zonedToUtcIso(toDate, to),
    source: 'CLOCK',
    note: null,
    editedById: null,
  });

describe('time cards', () => {
  it('splits a punch across the pay-period boundary at local midnight', async () => {
    await punch('2026-09-15', '22:00', '02:00', '2026-09-16'); // 2h on the 15th, 2h on the 16th
    const tc = await timeCardSummary('e1', period);
    expect(tc.total).toBe(2);
  });

  it('needs approving again when the punches change after approval', async () => {
    await punch('2026-09-17', '08:00', '12:00');
    let tc = await timeCardSummary('e1', period);
    await timeCards.insert({
      employeeId: 'e1',
      payPeriodId: 'p1',
      status: 'APPROVED',
      submittedAt: new Date().toISOString(),
      decidedById: 'admin',
      decidedAt: new Date().toISOString(),
      note: null,
      approvedRegularHours: tc.regular,
      approvedOvertimeHours: tc.overtime,
    });
    tc = await timeCardSummary('e1', period);
    expect(tc).toMatchObject({ status: 'APPROVED', approvalValid: true });

    await punch('2026-09-18', '08:00', '09:00');
    tc = await timeCardSummary('e1', period);
    expect(tc).toMatchObject({ status: 'CHANGED', approvalValid: false });
  });

  it('an open punch also blocks an approved card', async () => {
    const card = (await timeCards.all())[0];
    const tc0 = await timeCardSummary('e1', period);
    await timeCards.update(card.id, { approvedRegularHours: tc0.regular, approvedOvertimeHours: tc0.overtime });
    await timeEntries.insert({
      employeeId: 'e1',
      clockIn: zonedToUtcIso('2026-09-21', '08:00'),
      clockOut: null,
      source: 'CLOCK',
      note: null,
      editedById: null,
    });
    const tc = await timeCardSummary('e1', period);
    expect(tc).toMatchObject({ hasOpenEntry: true, approvalValid: false, status: 'CHANGED' });
  });
});
