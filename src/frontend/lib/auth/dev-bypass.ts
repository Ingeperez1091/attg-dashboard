/**
 * Determines if dev bypass is enabled.
 * - Always disabled in production (NODE_ENV=production)
 * - Enabled by default in development (NODE_ENV=development)
 * - Can be explicitly disabled with ENABLE_DEV_BYPASS=false env var
 *
 * Usage:
 * - `npm run dev` → bypass enabled (default for development)
 * - `npm run dev:sso` → bypass disabled (forces SSO authentication)
 * - Production builds → bypass disabled (always secure)
 */
export function isDevBypassEnabled(): boolean {
  // Always disabled in production - no bypass can be accidentally enabled
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  // In development, enabled by default unless explicitly disabled
  return process.env.ENABLE_DEV_BYPASS !== "false";
}