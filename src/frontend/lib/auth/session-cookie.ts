import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lightweight session identifier cookie (attg_sid).
 *
 * After successful Bearer token exchange, this small (~80 byte) HMAC-signed
 * cookie is set at path "/" so that server components can identify the user
 * on page requests without the large Auth.js JWT cookie.
 *
 * Format: base64url(userId) "." base64url(hmac-sha256(userId, secret))
 *
 * This cookie is NOT a session token — it only identifies which userId to
 * resolve from repositories. The Bearer token (in sessionStorage) remains
 * the authoritative credential for API calls.
 */

export const SESSION_ID_COOKIE_NAME = "attg_sid";

function getSecret(): string {
  const secret = process.env.SESSION_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_TOKEN_SECRET must be set and at least 32 characters.");
  }
  return secret;
}

function hmacSign(userId: string, secret: string): string {
  return createHmac("sha256", `sid:${secret}`)
    .update(userId)
    .digest("base64url");
}

export function createSessionIdCookieValue(userId: string): string {
  const secret = getSecret();
  const encodedId = Buffer.from(userId, "utf8").toString("base64url");
  const signature = hmacSign(userId, secret);
  return `${encodedId}.${signature}`;
}

export function verifySessionIdCookieValue(value: string): string | null {
  if (!value?.includes(".")) {
    return null;
  }

  const dotIndex = value.indexOf(".");
  const encodedId = value.slice(0, dotIndex);
  const providedSig = value.slice(dotIndex + 1);

  let userId: string;
  try {
    userId = Buffer.from(encodedId, "base64url").toString("utf8");
  } catch {
    return null;
  }

  if (!userId) {
    return null;
  }

  const secret = getSecret();
  const expectedSig = hmacSign(userId, secret);

  if (providedSig.length !== expectedSig.length) {
    return null;
  }

  const valid = timingSafeEqual(
    Buffer.from(providedSig, "utf8"),
    Buffer.from(expectedSig, "utf8")
  );

  return valid ? userId : null;
}
