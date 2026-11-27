import { describe, expect, it } from 'vitest';
import { allow, rateLimitKeys } from './rate-limit';

describe('rate limiter', () => {
  it('allows up to the limit, then refuses until the window passes', () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allow('a', 3, 1000, t + i)).toBe(true);
    expect(allow('a', 3, 1000, t + 10)).toBe(false);
    expect(allow('a', 3, 1000, t + 2000)).toBe(true);
  });

  it('does not grow when a key is flooded', () => {
    const t = 5_000_000;
    for (let i = 0; i < 10_000; i++) allow('flood', 5, 60_000, t + i);
    // Refused attempts aren't stored, so the limit frees up once the first 5 hits age out.
    expect(allow('flood', 5, 60_000, t + 60_001)).toBe(true);
  });

  it('sweeps out idle keys', () => {
    const t = 10_000_000;
    for (let i = 0; i < 50; i++) allow(`ip-${i}`, 5, 1000, t);
    const before = rateLimitKeys();
    allow('trigger', 5, 1000, t + 2 * 60 * 60_000);
    expect(rateLimitKeys()).toBeLessThan(before);
  });
});
