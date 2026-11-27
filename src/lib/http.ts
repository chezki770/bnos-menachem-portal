import { NextResponse } from 'next/server';
import { appUrl } from './email';

/** Reject cross-site form posts to route handlers (server actions do this check themselves). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin navigations from older browsers may omit it; cookies are SameSite=Lax
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    const o = new URL(origin);
    return o.host === host || o.origin === new URL(appUrl()).origin;
  } catch {
    return false;
  }
}

/** 303 redirect back to a portal page with a message. */
export function redirectBack(req: Request, path: string, msg: string, kind: 'ok' | 'error' = 'ok') {
  const url = new URL(path, req.url);
  url.searchParams.set(kind, msg);
  return NextResponse.redirect(url, 303);
}
