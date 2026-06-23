import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHash } from "node:crypto";


/**
 * Encrypted session token utility using AES-256-GCM + HMAC-SHA256.
 * Tokens are stored in sessionStorage on the client to avoid WAF cookie interference.
 *
 * The token payload is encrypted (not just signed) so that claims (userId, role,
 * applications) are not readable by inspecting sessionStorage or decoding the token.
 *
 * Supports zero-downtime secret rotation via SESSION_TOKEN_SECRET_PREVIOUS:
 * - New tokens are always encrypted/signed with the primary secret (SESSION_TOKEN_SECRET).
 * - Verification tries the primary secret first, then falls back to the previous secret.
 * - After one full token TTL has elapsed post-rotation, remove SESSION_TOKEN_SECRET_PREVIOUS.
 */

export interface SessionTokenPayload {
  userId: string;
  role: string;
  isActive: boolean;
  applications: string[];
  oid?: string;
  email?: string;
}

interface SignedToken {
  payload: SessionTokenPayload;
  iat: number;
  exp: number;
}

const TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes — short-lived to limit exposure window.
// The SessionProvider performs silent refresh every 10 minutes to keep active sessions alive.

/**
 * Returns the primary signing secret. Throws if not configured or too short.
 */
function getPrimarySecret(): string {
  const secret = process.env.SESSION_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_TOKEN_SECRET must be set and at least 32 characters.");
  }
  return secret;
}

/**
 * Returns an ordered list of secrets for verification:
 * [primary, previous (if configured)].
 * The primary secret is always first so tokens signed with it verify fastest.
 */
function getVerificationSecrets(): string[] {
  const primary = getPrimarySecret();
  const previous = process.env.SESSION_TOKEN_SECRET_PREVIOUS;
  if (previous && previous.length >= 32) {
    return [primary, previous];
  }
  return [primary];
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Derives a 32-byte AES encryption key from the signing secret.
 * Uses SHA-256 with a domain separator to ensure the encryption key
 * is cryptographically independent from the HMAC signing key.
 */
function deriveEncryptionKey(secret: string): Buffer {
  return createHash("sha256").update(`aes-enc:${secret}`).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns: base64url(iv || authTag || ciphertext)
 */
function encrypt(plaintext: string, secret: string): string {
  const key = deriveEncryptionKey(secret);
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Pack: iv (12) + authTag (16) + ciphertext (variable)
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64url");
}

/**
 * Decrypts an AES-256-GCM ciphertext blob.
 * Returns null if decryption or authentication fails.
 */
function decrypt(blob: string, secret: string): string | null {
  try {
    const key = deriveEncryptionKey(secret);
    const packed = Buffer.from(blob, "base64url");
    if (packed.length < 28) return null; // iv(12) + tag(16) = 28 minimum

    const iv = packed.subarray(0, 12);
    const authTag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Creates a new session token: encrypts the payload with AES-256-GCM,
 * then signs the ciphertext with HMAC-SHA256.
 * Format: <encrypted-blob>.<hmac-signature>
 */
export function createSessionToken(payload: SessionTokenPayload): string {
  const secret = getPrimarySecret();
  const now = Math.floor(Date.now() / 1000);

  const tokenData: SignedToken = {
    payload,
    iat: now,
    exp: now + TOKEN_MAX_AGE_SECONDS,
  };

  const encryptedBlob = encrypt(JSON.stringify(tokenData), secret);
  const signature = sign(encryptedBlob, secret);

  return `${encryptedBlob}.${signature}`;
}

/**
 * Verifies and decrypts a token against the primary secret, falling back to the
 * previous secret if configured (supports zero-downtime rotation).
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  const secrets = getVerificationSecrets();

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex < 1) return null;

  const encryptedBlob = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  for (const secret of secrets) {
    // Verify HMAC signature
    const expectedSignature = sign(encryptedBlob, secret);
    if (!safeCompare(signature, expectedSignature)) continue;

    // Decrypt the payload
    const json = decrypt(encryptedBlob, secret);
    if (!json) continue;

    let parsed: SignedToken;
    try {
      parsed = JSON.parse(json);
    } catch {
      continue;
    }

    const now = Math.floor(Date.now() / 1000);
    if (!parsed.exp || parsed.exp < now) return null;
    if (!parsed.payload?.userId) return null;

    return parsed.payload;
  }

  return null;
}
