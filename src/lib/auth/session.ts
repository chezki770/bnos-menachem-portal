import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE = 'bnos_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type SessionUser = { id: string; role: 'ADMIN' | 'STAFF'; name: string };

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be set to a long random value (openssl rand -base64 32)');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  user: SessionUser,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(key());
}

/** Returns the session user, or null for a missing, tampered or expired token. */
export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    const role = payload.role;
    if (!payload.sub || (role !== 'ADMIN' && role !== 'STAFF') || typeof payload.name !== 'string')
      return null;
    return { id: payload.sub, role, name: payload.name };
  } catch {
    return null;
  }
}
