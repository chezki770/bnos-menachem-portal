import { describe, expect, it } from 'vitest';
import type { Contract, Employee } from '@/lib/store';
import { contractSections } from './contract';

const contract = {
  id: 'c1',
  employeeId: 'e1',
  schoolYearId: 'y1',
  type: 'FULL_YEAR',
  status: 'SIGNED',
  sentAt: null,
  remindedAt: null,
  signedAt: null,
  signedName: 'Taylor Brooks',
  signedIp: null,
  handbookVersion: '2026-2027',
  periodsPerWeek: 12,
  annualSalaryCents: 3_600_000,
  hourlyRateCents: null,
  employeeName: 'Taylor Brooks',
  position: 'Teacher',
  department: 'Elementary',
  daysPerWeek: 4,
  yearsAtSchool: 2,
} satisfies Contract;

const employeeNow = {
  name: 'Taylor Brooks-Levy',
  position: 'Principal',
  department: 'High School',
  daysPerWeek: 5,
  yearsAtSchool: 12,
} as Employee;

const text = (c: Contract) =>
  contractSections(c, employeeNow, undefined)
    .map((s) => s.body)
    .join('\n');

describe('contract text', () => {
  it('uses the terms saved when the contract was sent, not the current employee record', () => {
    const t = text(contract);
    expect(t).toContain('Taylor Brooks ("the Employee")');
    expect(t).toContain('Teacher, Elementary department, 12 periods per week over 4 days');
    expect(t).toContain('Paid time off: 4 day(s)');
    expect(t).not.toMatch(/Principal|High School|5 days/);
  });

  it('falls back to the employee record for contracts saved before the snapshot columns existed', () => {
    const legacy = {
      ...contract,
      employeeName: null,
      position: null,
      department: null,
      daysPerWeek: null,
      yearsAtSchool: null,
    };
    expect(text(legacy)).toContain('Principal, High School department, 12 periods per week over 5 days');
  });
});
