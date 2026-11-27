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

/**
 * 303 redirect to a portal path. The Location header is relative on purpose: behind Docker/Caddy,
 * req.url carries the container's bind address (http://0.0.0.0:3000), not the address the browser used.
 */
export function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}

/** 303 redirect back to a portal page with a message. */
export function redirectBack(path: string, msg: string, kind: 'ok' | 'error' = 'ok'): Response {
  const url = new URL(path, 'http://portal.invalid');
  url.searchParams.set(kind, msg);
  return redirectTo(`${url.pathname}${url.search}`);
}
