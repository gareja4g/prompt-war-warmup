/**
 * Rate limiting with Upstash Redis (primary) and in-memory fallback (secondary).
 *
 * Upstash is used when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 * Otherwise, a sliding-window in-memory store is used (not suitable for multi-instance).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (seconds) when the window resets
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const API_LIMIT = { limit: 100, window: '1 m' } as const;
export const CHAT_LIMIT = { limit: 20, window: '1 m' } as const;
export const AUTH_LIMIT = { limit: 10, window: '15 m' } as const;
export const JOURNAL_LIMIT = { limit: 50, window: '1 h' } as const;

// ---------------------------------------------------------------------------
// In-memory sliding-window fallback
// ---------------------------------------------------------------------------

interface MemoryEntry {
  tokens: number[];   // Array of request timestamps (ms)
  reset: number;      // When the oldest token expires (ms)
}

const memoryStore = new Map<string, MemoryEntry>();

function parseWindowMs(window: string): number {
  const [value, unit] = window.trim().split(/\s+/);
  const num = parseInt(value ?? '1', 10);
  switch ((unit ?? 'm').toLowerCase()) {
    case 's':
    case 'sec':
    case 'second':
    case 'seconds':
      return num * 1_000;
    case 'm':
    case 'min':
    case 'minute':
    case 'minutes':
      return num * 60_000;
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      return num * 3_600_000;
    case 'd':
    case 'day':
    case 'days':
      return num * 86_400_000;
    default:
      return num * 60_000;
  }
}

function inMemoryRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(identifier) ?? { tokens: [], reset: now + windowMs };

  // Slide the window: remove timestamps older than the window
  const windowStart = now - windowMs;
  const validTokens = entry.tokens.filter((t) => t > windowStart);

  const success = validTokens.length < limit;

  if (success) {
    validTokens.push(now);
  }

  const reset = Math.floor((now + windowMs) / 1_000);

  memoryStore.set(identifier, { tokens: validTokens, reset: now + windowMs });

  // Periodic cleanup to avoid unbounded memory growth
  if (memoryStore.size > 10_000) {
    const cutoff = now;
    for (const [key, val] of memoryStore.entries()) {
      if (val.reset < cutoff) {
        memoryStore.delete(key);
      }
    }
  }

  return {
    success,
    limit,
    remaining: Math.max(0, limit - validTokens.length),
    reset,
  };
}

// ---------------------------------------------------------------------------
// Upstash Redis client (lazy-loaded to avoid import errors when not configured)
// ---------------------------------------------------------------------------

let upstashInitialized = false;
let upstashRatelimit: {
  limit: (identifier: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
} | null = null;

async function getUpstashLimiter(
  limit: number,
  window: string,
): Promise<typeof upstashRatelimit> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    const { Redis } = await import('@upstash/redis');
    const { Ratelimit } = await import('@upstash/ratelimit');

    const redis = new Redis({ url, token });

    const windowParts = window.trim().split(/\s+/);
    const duration = `${windowParts[0]} ${windowParts[1]}` as `${number} s` | `${number} m` | `${number} h` | `${number} d`;

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, duration),
      analytics: false,
      prefix: 'mindguard:rl',
    });

    upstashInitialized = true;
    return {
      limit: async (identifier: string) => {
        const result = await ratelimit.limit(identifier);
        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          reset: Math.floor(result.reset / 1_000),
        };
      },
    };
  } catch {
    // @upstash packages not installed or connection failed; fall through to in-memory
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core export
// ---------------------------------------------------------------------------

/**
 * Rate-limit an arbitrary identifier.
 *
 * @param identifier - Unique key (e.g. IP, userId, email)
 * @param limit      - Maximum requests allowed in the window
 * @param window     - Window duration string, e.g. "1 m", "15 m", "1 h"
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  window: string,
): Promise<RateLimitResult> {
  const upstash = await getUpstashLimiter(limit, window);

  if (upstash) {
    try {
      return await upstash.limit(identifier);
    } catch (err) {
      console.warn('[RateLimit] Upstash error, falling back to in-memory:', err);
    }
  }

  const windowMs = parseWindowMs(window);
  return inMemoryRateLimit(identifier, limit, windowMs);
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Rate-limit by client IP address extracted from the request.
 */
export async function rateLimitByIP(
  request: Request,
  limit = API_LIMIT.limit,
  window = API_LIMIT.window,
): Promise<RateLimitResult> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  return rateLimit(`ip:${ip}`, limit, window);
}

/**
 * Rate-limit by authenticated user ID.
 */
export async function rateLimitByUser(
  userId: string,
  limit = API_LIMIT.limit,
  window = API_LIMIT.window,
): Promise<RateLimitResult> {
  return rateLimit(`user:${userId}`, limit, window);
}
