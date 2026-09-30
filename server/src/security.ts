import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newPublicRef(): string {
  return randomBytes(6).toString("base64url");
}

/** Stand-in name for players without a nickname or whose nickname was moderated. */
export function placeholderName(publicRef: string): string {
  let n = 0;
  for (const ch of publicRef) n = (n * 31 + ch.charCodeAt(0)) % 10000;
  return `Joueur${String(n).padStart(4, "0")}`;
}

/**
 * Fixed-window rate limiter, in memory. Enough for a single Render instance; limits reset on
 * deploy, which is acceptable for abuse protection (not billing).
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 50_000) this.sweep(now);
      return true;
    }
    entry.count++;
    return entry.count <= this.limit;
  }

  private sweep(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
