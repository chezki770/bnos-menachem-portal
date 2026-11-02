import { beforeAll, describe, expect, it } from 'vitest';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';
import { signSession, verifySession } from './session';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
});

describe('session tokens', () => {
  const user = { id: 'abc', role: 'STAFF' as const, name: 'Taylor Brooks' };

  it('round-trips a signed session', async () => {
    expect(await verifySession(await signSession(user))).toEqual(user);
  });
  it('rejects missing, garbage and tampered tokens', async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('nonsense')).toBeNull();
    const token = await signSession(user);
    expect(await verifySession(token.slice(0, -2) + 'xx')).toBeNull();
  });
  it('rejects expired tokens', async () => {
    expect(await verifySession(await signSession(user, -10))).toBeNull();
  });
  it('rejects tokens signed with another secret', async () => {
    const token = await signSession(user);
    process.env.AUTH_SECRET = 'a-completely-different-secret-value';
    expect(await verifySession(token)).toBeNull();
    process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
  });
  it('refuses to run without a real secret', async () => {
    process.env.AUTH_SECRET = 'short';
    await expect(signSession(user)).rejects.toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret';
  });
});

describe('passwords', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
  it('the dummy hash is a valid hash that never matches', async () => {
    expect(await verifyPassword('anything', DUMMY_HASH)).toBe(false);
  });
});
