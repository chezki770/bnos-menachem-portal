import { redirect } from 'next/navigation';
import { z } from 'zod';

/** Redirect back to a page with a message shown by <Notice>. */
export function back(path: string, message: string, kind: 'ok' | 'error' = 'ok'): never {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

/** FormData → plain object for Zod. Checkboxes become booleans when listed. */
export function formObject(fd: FormData, booleans: string[] = []): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string' && !k.startsWith('$ACTION')) obj[k] = v.trim();
  for (const b of booleans) obj[b] = fd.get(b) === 'on' || fd.get(b) === 'true';
  return obj;
}

export function firstError(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.length ? `${String(i.path[0])}: ` : ''}${i.message}` : 'Invalid input';
}

/**
 * Only allow redirects to paths inside the portal. Browsers treat "\" like "/", so "/\evil.example"
 * would be a protocol-relative link to another site; backslashes and control characters are refused.
 */
export function safePath(p: unknown, fallback: string): string {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(p)) return fallback;
  const base = 'http://portal.invalid';
  try {
    return new URL(p, base).origin === base ? p : fallback;
  } catch {
    return fallback;
  }
}
