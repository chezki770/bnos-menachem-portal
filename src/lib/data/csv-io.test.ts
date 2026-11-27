import { beforeAll, describe, expect, it } from 'vitest';
import { col } from '@/lib/store/columns';
import { Table } from '@/lib/store/table';
import { exportCsv, planImport } from './csv-io';

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
});

const people = new Table('people_io', {
  id: col.text(),
  email: col.text(),
  name: col.text(),
  periods: col.int(),
  active: col.bool(),
  hash: col.internal(),
  phone: col.secret(),
});
const existing = [
  { id: 'a', email: 'ann@x.org', name: 'Ann', periods: 10, active: true, hash: 'H1', phone: '555' },
  { id: 'b', email: 'bo@x.org', name: 'Bo', periods: 5, active: true, hash: null, phone: null },
];

describe('export', () => {
  it('leaves out internal columns and, by default, sensitive ones', () => {
    expect(exportCsv(people as never, existing as never, false).split('\n')[0]).toBe(
      'id,email,name,periods,active',
    );
    const withSecret = exportCsv(people as never, existing as never, true);
    expect(withSecret.split('\n')[0]).toBe('id,email,name,periods,active,phone');
    expect(withSecret).toContain('555');
    expect(withSecret).not.toContain('H1');
  });
});

describe('import', () => {
  const plan = (text: string, mode: 'merge' | 'replace' = 'merge') =>
    planImport(
      people as never,
      text,
      existing.map((r) => ({ ...r })),
      { mode, matchBy: 'email', defaults: { active: 'true' } },
    );

  it('updates only the columns in the file and matches by email', () => {
    const p = plan('email,periods\nann@x.org,12\n');
    expect(p.errors).toEqual([]);
    expect(p.updated).toBe(1);
    expect(p.rows.find((r) => r.id === 'a')).toMatchObject({
      name: 'Ann',
      periods: 12,
      hash: 'H1',
      phone: '555',
    });
    expect(p.rows).toHaveLength(2);
  });
  it('adds new rows with defaults and a new id', () => {
    const p = plan('email,name,periods\ncy@x.org,Cy,3\n');
    expect(p.inserted).toBe(1);
    const cy = p.rows.find((r) => r.email === 'cy@x.org')!;
    expect(cy).toMatchObject({ name: 'Cy', periods: 3, active: true });
    expect(cy.id).toMatch(/[0-9a-f-]{36}/);
  });
  it('reports bad cells with their line and writes nothing', () => {
    const p = plan('email,name,periods\nann@x.org,Ann,ten\ncy@x.org,Cy,\n');
    expect(p.errors.map((e) => e.line)).toEqual([2, 3]);
    expect(p.errors[0].message).toContain('periods');
    expect(p.rows.find((r) => r.id === 'a')?.periods).toBe(10);
  });
  it('rejects a misspelled boolean instead of reading it as false', () => {
    const p = plan('email,active\nann@x.org,tru\n');
    expect(p.errors[0].message).toMatch(/active.*true or false/);
    expect(p.rows.find((r) => r.id === 'a')?.active).toBe(true);
  });
  it('rejects unknown and internal columns', () => {
    expect(plan('email,hash\nann@x.org,x\n').errors[0].message).toMatch(/Unknown column\(s\): hash/);
  });
  it('restores formula-escaped cells from spreadsheet exports', () => {
    const p = plan("email,name\nann@x.org,'=Ann\n");
    expect(p.rows.find((r) => r.id === 'a')?.name).toBe('=Ann');
  });
  it('replace mode drops rows not in the file but keeps internal columns of matches', () => {
    const p = plan('id,email,name,periods,active\na,ann@x.org,Ann,10,true\n', 'replace');
    expect(p.removed).toBe(1);
    expect(p.rows).toEqual([{ ...existing[0] }]);
  });
  it('flags duplicate rows', () => {
    expect(plan('email,periods\nann@x.org,1\nann@x.org,2\n').errors[0].message).toMatch(/Duplicate/);
  });
  it('runs custom checks', () => {
    const p = planImport(people as never, 'email,name,periods\nzed@x.org,Zed,99\n', [], {
      mode: 'merge',
      defaults: { active: 'true' },
      check: (r) => ((r.periods as number) > 60 ? 'Too many periods' : null),
    });
    expect(p.errors[0].message).toBe('Too many periods');
  });
});
