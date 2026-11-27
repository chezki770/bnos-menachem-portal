import { randomBytes } from 'node:crypto';
import { sha256 } from '@/lib/store/crypto';
import { tokens } from '@/lib/store';

const TTL_HOURS = { INVITE: 24 * 7, RESET: 2 } as const;

/** Creates a one-time link token. Only its hash is stored. */
export async function createToken(employeeId: string, kind: 'INVITE' | 'RESET'): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const now = new Date();
  await tokens.mutate((rows) => {
    // Both kinds can set the password, so every older unused link for this person stops working.
    for (const t of rows) if (t.employeeId === employeeId && !t.usedAt) t.usedAt = now.toISOString();
    rows.push({
      id: crypto.randomUUID(),
      employeeId,
      kind,
      tokenHash: sha256(raw),
      expiresAt: new Date(now.getTime() + TTL_HOURS[kind] * 3600_000).toISOString(),
      usedAt: null,
      createdAt: now.toISOString(),
    });
  });
  return raw;
}

/** The employee id for a valid, unused, unexpired token, or null. */
export async function peekToken(
  raw: string,
): Promise<{ employeeId: string; kind: 'INVITE' | 'RESET' } | null> {
  const hash = sha256(raw);
  const t = await tokens.find((r) => r.tokenHash === hash);
  if (!t || t.usedAt || Date.parse(t.expiresAt) < Date.now()) return null;
  return { employeeId: t.employeeId, kind: t.kind };
}

export async function consumeToken(raw: string): Promise<{ employeeId: string } | null> {
  const hash = sha256(raw);
  return tokens.mutate((rows) => {
    const t = rows.find((r) => r.tokenHash === hash);
    if (!t || t.usedAt || Date.parse(t.expiresAt) < Date.now()) return null;
    // Using one link ends all of that person's other open links, whatever their kind.
    const now = new Date().toISOString();
    for (const r of rows) if (r.employeeId === t.employeeId && !r.usedAt) r.usedAt = now;
    return { employeeId: t.employeeId };
  });
}
