/**
 * Simple in-memory limiter (one server process): allows at most `limit` hits per key within
 * `windowMs`. Memory stays bounded under a flood: refused attempts are not recorded, each key keeps at
 * most `limit` timestamps, and idle keys are swept out.
 */
const g = globalThis as unknown as { __rate?: Map<string, number[]>; __rateSweep?: number };
const hits: Map<string, number[]> = (g.__rate ??= new Map());

const MAX_WINDOW_MS = 60 * 60_000; // keys idle longer than this are always removed
const SWEEP_EVERY_MS = 60_000;

function sweep(now: number) {
  if (now - (g.__rateSweep ?? 0) < SWEEP_EVERY_MS) return;
  g.__rateSweep = now;
  for (const [key, times] of hits)
    if (!times.length || now - times[times.length - 1] > MAX_WINDOW_MS) hits.delete(key);
}

export function allow(key: string, limit = 8, windowMs = 15 * 60_000, now = Date.now()): boolean {
  sweep(now);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent); // refused: nothing added
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** For tests. */
export function rateLimitKeys(): number {
  return hits.size;
}
