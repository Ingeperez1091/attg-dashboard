/**
 * Shared utility for generating and sanitizing request IDs.
 *
 * Used by middleware.ts and [...nextauth]/route.ts to ensure consistent
 * sanitization of externally-supplied x-request-id headers.
 *
 * Sanitization prevents log injection via control characters (newlines,
 * null bytes, JSON-breaking chars) that could confuse log aggregators or SIEMs.
 */

const MAX_REQUEST_ID_LENGTH = 128;

/**
 * Returns the incoming request ID (sanitized) or generates a new UUID.
 * Strips ASCII control characters (0x00–0x1F, 0x7F) to prevent log injection.
 */
export function getOrCreateRequestId(existing?: string | null): string {
  if (existing?.trim()) {
    const sanitized = existing.trim().replace(/[\x00-\x1f\x7f]/g, "");
    if (sanitized.length > 0 && sanitized.length <= MAX_REQUEST_ID_LENGTH) {
      return sanitized;
    }
  }

  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
