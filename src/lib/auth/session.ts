import { jwtVerify, SignJWT } from 'jose';
import { ROLES, type Role } from '@/lib/store';

export const SESSION_COOKIE = 'bnos_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

/** What the signed cookie carries. Role and status are re-checked against employees.csv on every request. */
export type SessionToken = { id: string; role: Role; name: string };

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be set to a long random value (openssl rand -base64 32)');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  user: SessionToken,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(key());
}

/** Returns the session, or null for a missing, tampered or expired token. */
export async function verifySession(token: string | undefined): Promise<SessionToken | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    const role = payload.role as Role;
    if (!payload.sub || !ROLES.includes(role) || typeof payload.name !== 'string') return null;
    return { id: payload.sub, role, name: payload.name };
  } catch {
    return null;
  }
}
