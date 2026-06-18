/**
 * Lightweight in-memory rate limiter for API routes.
 * Uses a sliding-window counter per client identifier (typically IP).
 *
 * NOTE: This is per-process. In multi-instance deployments, use Azure API
 * Management or a shared store (Redis) for distributed rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60;

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent unbounded memory growth
let cleanupScheduled = false;
function scheduleCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setTimeout(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
    cleanupScheduled = false;
  }, 5 * 60_000).unref(); // every 5 minutes
}

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Checks whether a request from the given client ID is within rate limits.
 */
export function checkRateLimit(
  clientId: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  // Bypass rate limiting in Playwright test mode
  if (process.env.PLAYWRIGHT_TEST === "true") {
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60_000 };
  }
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const now = Date.now();

  const entry = store.get(clientId);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + windowMs;
    store.set(clientId, { count: 1, resetAt });
    scheduleCleanup();
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Extracts the client IP from a request (uses x-forwarded-for when behind a proxy/WAF).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP (original client) from the chain
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * Returns a 429 Response with standard rate-limit headers.
 */
export function rateLimitedResponse(result: RateLimitResult, requestId?: string): Response {
  const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
  return Response.json(
    { error: "RATE_LIMITED", message: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(retryAfterSeconds, 1)),
        ...(requestId ? { "x-request-id": requestId } : {}),
      },
    }
  );
}
