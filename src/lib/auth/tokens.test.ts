import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { safePath } from '@/lib/actions';
import { consumeToken, createToken, peekToken } from './tokens';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'bnos-tokens-'));
  process.env.DATA_DIR = dir;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('password links', () => {
  it('a new reset link ends an older invite link', async () => {
    const invite = await createToken('emp-1', 'INVITE');
    const reset = await createToken('emp-1', 'RESET');
    expect(await peekToken(invite)).toBeNull();
    expect(await peekToken(reset)).toMatchObject({ employeeId: 'emp-1', kind: 'RESET' });
  });

  it('links work once', async () => {
    const t = await createToken('emp-2', 'INVITE');
    expect(await consumeToken(t)).toEqual({ employeeId: 'emp-2' });
    expect(await consumeToken(t)).toBeNull();
  });

  it("other people's links are untouched", async () => {
    const a = await createToken('emp-3', 'INVITE');
    await createToken('emp-4', 'RESET');
    expect(await peekToken(a)).not.toBeNull();
  });
});

describe('safePath', () => {
  it('keeps portal paths', () => {
    expect(safePath('/employees?tab=info', '/x')).toBe('/employees?tab=info');
  });
  it.each([
    '//evil.example',
    '/\\evil.example',
    '/\\/evil.example',
    'https://evil.example',
    '/ok\nnext',
    '',
    null,
  ])('refuses %j', (p) => {
    expect(safePath(p, '/fallback')).toBe('/fallback');
  });
});
