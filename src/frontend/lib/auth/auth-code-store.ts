/**
 * Short-lived in-memory store for one-time auth codes.
 * After OAuth callback completes, we store the user's identity claims under a random code.
 * The client exchanges this code (via /api/auth/exchange) for a Bearer token.
 *
 * Codes expire after 60 seconds and are single-use (deleted on first retrieval).
 * A periodic sweep removes expired entries to prevent memory leaks.
 */

export interface AuthCodeClaims {
  oid: string | null;
  email: string | null;
}

interface StoredCode {
  claims: AuthCodeClaims;
  expiresAt: number;
}

const CODE_TTL_MS = 60_000; // 60 seconds
const SWEEP_INTERVAL_MS = 30_000; // sweep every 30s
const MAX_PENDING_CODES = 100; // safety cap

const codeStore = new Map<string, StoredCode>();

// Periodic sweep to prevent memory leaks from unused codes
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function ensureSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of codeStore) {
      if (entry.expiresAt <= now) {
        codeStore.delete(code);
      }
    }
    // Stop sweeping if empty
    if (codeStore.size === 0 && sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }, SWEEP_INTERVAL_MS);
  // Don't prevent Node from exiting
  if (sweepTimer && typeof sweepTimer === "object" && "unref" in sweepTimer) {
    sweepTimer.unref();
  }
}

/**
 * Creates a one-time auth code linked to the given claims.
 * Returns the code string (URL-safe, 64 hex chars).
 */
export function createAuthCode(claims: AuthCodeClaims): string {
  // Evict oldest if at capacity
  if (codeStore.size >= MAX_PENDING_CODES) {
    const firstKey = codeStore.keys().next().value;
    if (firstKey) codeStore.delete(firstKey);
  }

  // Use Web Crypto API (available in Node.js, Edge, and browsers)
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  codeStore.set(code, {
    claims,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  ensureSweep();
  return code;
}

/**
 * Consumes a one-time auth code. Returns the claims if valid, null otherwise.
 * The code is deleted after retrieval (single-use).
 */
export function consumeAuthCode(code: string): AuthCodeClaims | null {
  const entry = codeStore.get(code);
  if (!entry) return null;

  // Always delete (single-use)
  codeStore.delete(code);

  // Check expiry
  if (entry.expiresAt <= Date.now()) return null;

  return entry.claims;
}
