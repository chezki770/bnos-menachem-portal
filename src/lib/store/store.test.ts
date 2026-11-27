import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { col } from './columns';
import { decryptBuffer, decryptText, encryptBuffer, encryptText } from './crypto';
import { fromSpreadsheet, parseCsv, parseCsvRecords, spreadsheetSafe, stringifyCsv } from './csv';
import { Table } from './table';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'bnos-store-'));
  process.env.DATA_DIR = dir;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [
      ['id', 'note'],
      ['1', 'Said "hi", then left\nnext line'],
      ['2', ' padded '],
    ];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
  it('handles CRLF, a BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n3,\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', ''],
    ]);
  });
  it('rejects duplicate headers and rows with extra values', () => {
    expect(() => parseCsvRecords('id,name,id\n1,a,2\n')).toThrow(/appears twice/);
    expect(() => parseCsvRecords('id,note\n1,hello, world\n')).toThrow(/Line 2 has 3 values/);
    expect(parseCsvRecords('id,note\n1,ok,,\n').records).toEqual([{ id: '1', note: 'ok' }]);
  });
  it('rejects an unclosed quote', () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/unclosed/);
  });
  it('neutralises spreadsheet formulas on export and restores them on import', () => {
    expect(spreadsheetSafe('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(spreadsheetSafe('-5')).toBe('-5');
    expect(fromSpreadsheet(spreadsheetSafe('@SUM(A1)'))).toBe('@SUM(A1)');
    expect(fromSpreadsheet("'quoted")).toBe("'quoted");
  });
});

describe('crypto', () => {
  it('encrypts text and buffers', () => {
    const enc = encryptText('1990-04-02');
    expect(enc).not.toContain('1990');
    expect(decryptText(enc)).toBe('1990-04-02');
    expect(decryptText('plain')).toBe('plain');
    expect(decryptBuffer(encryptBuffer(Buffer.from('pdf'))).toString()).toBe('pdf');
  });
});

describe('Table', () => {
  const people = new Table('people', {
    id: col.text(),
    name: col.text(),
    age: col.intOpt(),
    active: col.bool(),
    born: col.dateOpt(),
    phone: col.secret(),
  });

  it('starts empty, inserts, updates and removes', async () => {
    expect(await people.all()).toEqual([]);
    const a = await people.insert({
      name: 'Ann',
      age: 30,
      active: true,
      born: '1996-01-02',
      phone: '555-1234',
    });
    await people.insert({ name: 'Bo', age: null, active: false, born: null, phone: null });
    expect((await people.all()).map((p) => p.name)).toEqual(['Ann', 'Bo']);
    await people.update(a.id, { age: 31 });
    expect((await people.get(a.id))?.age).toBe(31);
    expect(await people.remove(a.id)).toBe(true);
    expect((await people.all()).map((p) => p.name)).toEqual(['Bo']);
  });

  it('encrypts secret columns in the file', async () => {
    await people.insert({ name: 'Cy', age: 5, active: true, born: null, phone: '555-9999' });
    const text = await readFile(people.file, 'utf8');
    expect(text.split('\n')[0]).toBe('id,name,age,active,born,phone');
    expect(text).not.toContain('555-9999');
    expect((await people.find((p) => p.name === 'Cy'))?.phone).toBe('555-9999');
  });

  it('picks up edits made directly to the file', async () => {
    await writeFile(people.file, 'id,name,age,active,born,phone\nx1,Dee,,yes,,\n');
    expect(await people.all()).toEqual([
      { id: 'x1', name: 'Dee', age: null, active: true, born: null, phone: null },
    ]);
  });

  it('reports bad data with the line and column', async () => {
    await writeFile(people.file, 'id,name,age,active,born,phone\nx1,Dee,abc,yes,,\n');
    await expect(people.all()).rejects.toThrow(/people\.csv line 2: column "age"/);
  });

  it('refuses to write invalid rows', async () => {
    await writeFile(people.file, 'id,name,age,active,born,phone\n');
    await expect(
      people.insert({ name: 'Bad', age: 1, active: true, born: 'not-a-date', phone: null }),
    ).rejects.toThrow(/born/);
    expect(await people.all()).toEqual([]);
  });

  it('serialises concurrent writes without losing any', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        people.insert({ name: `P${i}`, age: i, active: true, born: null, phone: null }),
      ),
    );
    expect(await people.all()).toHaveLength(25);
  });

  it('appends rows to a log file', async () => {
    const log = new Table('log', { id: col.text(), msg: col.text() });
    await log.append({ msg: 'one' });
    await log.append({ msg: 'two, with comma' });
    expect((await log.all()).map((r) => r.msg)).toEqual(['one', 'two, with comma']);
  });
});
