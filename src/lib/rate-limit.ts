/** Simple in-memory limiter (one server process). Returns false once `limit` hits happen within `windowMs`. */
const g = globalThis as unknown as { __rate?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__rate ??= new Map());

export function allow(key: string, limit = 8, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= limit;
}
