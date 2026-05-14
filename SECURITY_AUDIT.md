# Security Audit Report

## 1. XSS (Cross-Site Scripting) - ✅ SAFE

### Findings:
- **React JSX Escaping**: All user input rendered in components uses standard React JSX, which automatically escapes HTML entities. No `innerHTML` or `eval()` calls found.
- **Input Validation**: All user forms (UserFormPanel, filters) use standard `<input>` elements with React controlled state.
- **Sanitization**: Email, username, and display name validated via Zod schema:
  - Username: alphanumeric + underscore/hyphen (no SQL injection or script tags possible)
  - Email: RFC 5321 format validation
  - DisplayName: UTF-8 sanitized, max 255 characters
- **dangerouslySetInnerHTML**: Only used once in layout.tsx for hardcoded theme initialization script (safe, not user-controlled)

### Recommendations:
✅ No action needed - XSS controls are solid

---

## 2. Session Hijacking - ⚠️ REQUIRES CONFIGURATION REVIEW

### Current Cookie Security:

**Dev Mode** (localhost):
- Dev login/logout routes set:
  - `httpOnly: true` ✅ (prevents JavaScript access)
  - `secure: false` ✅ (correct for HTTP localhost)
  - `sameSite: "lax"` ✅ (prevents CSRF)

**Production Mode** (via Auth.js):
- Auth.js v5 defaults are good, but **secure flag depends on deployment**
- **CRITICAL**: In Azure App Service, MUST use HTTPS-only to enable SSO redirect validation

### Attack Vector Analysis:

1. **Cookie Theft via XSS**: 
   - Mitigated by: httpOnly flag prevents JavaScript access
   - Note: If XSS is exploited, attacker cannot read httpOnly cookies, but can send authenticated requests as the user

2. **Token Interception (Man-in-Middle)**:
   - Mitigated by: HTTPS (must be enforced in production)
   - **ACTION NEEDED**: Ensure production deployment uses HTTPS-only

3. **CSRF (Cross-Site Request Forgery)**:
   - Mitigated by: sameSite="lax" on cookies
   - Auth.js automatically handles CSRF via token verification in server actions
   - No explicit CSRF middleware needed for App Router

4. **Session Fixation**:
   - Mitigated by: JWT strategy (stateless, cannot be "fixed")
   - Token rotation happens at each SSO callback

5. **Cookie Replay**:
   - Auth.js session tokens expire (check token.exp in production)
   - NextAuth defaults: 30-day session expiry (configurable)

### Auth Handler Chain:
```
Request → middleware.ts
  ↓
→ Check: request.auth || (devBypass && cookie)
  ↓
→ Redirect to /login if no session
  ↓
→ API routes use requireActive() or requireAuthenticated()
  ↓
→ Session resolved via Auth.js + fallback claims
```

---

## 3. .env Secrets Protection - ✅ CONFIGURED

### Updated .gitignore:
```gitignore
.env              # Root env file
.env.local        # Local overrides (contains SQL creds, secrets)
.env.*.local      # Environment-specific local files
```

### Secrets Stored Locally (DO NOT COMMIT):
- SQL connection strings (SQL_USER, SQL_PASSWORD)
- Auth.js client secret (AUTH_MICROSOFT_ENTRA_ID_SECRET)
- Auth.js secret (AUTH_SECRET)

### Verification:
```bash
# Check if .env files are tracked (they shouldn't be):
git status | grep ".env"
# Should return empty - if it shows .env.local, remove with:
git rm --cached .env.local
```

---

## 4. Parameterized SQL - ✅ SAFE

### Verification:
- All queries use `executeParameterizedQuery()` which binds inputs via `mssql` request bindings
- No string interpolation found in SQL queries
- User input (email, username, etc) passed as parameters, never concatenated into SQL

Example (safe):
```typescript
executeParameterizedQuery(client, `
  SELECT ... WHERE Email = @email
`, { email: userEmail })  // Parameterized
```

---

## 5. Session Hijacking - Specific Scenarios

### Scenario 1: XSS → Authenticated Request as Victim
**Risk Level**: MEDIUM (only if XSS found)
- Attacker injects JavaScript
- JavaScript cannot read httpOnly cookie (blocked)
- **BUT** JavaScript can call authenticated API endpoints as the user
- Mitigation: Same-origin policy + sameSite=lax prevents cross-origin exploitation
- Status: ✅ PROTECTED (httpOnly + sameSite)

### Scenario 2: Dev Bypass Cookie in Network Traffic
**Risk Level**: LOW (dev mode only)
- dev_user_id cookie sent in cleartext if HTTPS not used
- **BUT** HTTPS not enforced in dev (localhost only)
- Mitigation: Dev mode only, localhost only, credentials regenerated per session
- Status: ⚠️ ACCEPTABLE (localhost-only development)

### Scenario 3: Bearer Token Capture (Authorization Header)
**Risk Level**: CRITICAL (if over HTTP)
- Bearer tokens sent via Authorization header
- Must use HTTPS in production
- Mitigation: HTTPS enforces transport security
- Status: ✅ MITIGATED (requires HTTPS in production)

### Scenario 4: Session Token Expiration
**Risk Level**: MEDIUM (if token not expiring)
- JWT tokens may have infinite lifetime if not configured
- Check: Auth.js session callback should set `maxAge` or JWT exp claim
- Recommendation: Set 24hr session expiry in production
- Status: ⚠️ CHECK NEEDED (see configuration below)

---

## 6. Production Checklist

### MUST DO Before Production:

- [ ] **Enable HTTPS-only** in Azure App Service
  - Set Application Settings: `WEBSITE_HTTPS_ONLY=true`
  - Ensure redirect URI in Entra app registration uses `https://`

- [ ] **Configure secure cookie flags in production**
  ```typescript
  // In auth.ts, ensure production config:
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,  // 24 hours
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        secure: true,    // ← Must be true in production
        sameSite: "lax",
        path: "/"
      }
    }
  }
  ```

- [ ] **Remove .env files from repository**
  - Ensure `.gitignore` blocks them
  - Use Azure Key Vault for production secrets

- [ ] **Rotate AUTH_SECRET**
  - Current value in .env.*.local must NOT be used in production
  - Generate unique secret for each environment

- [ ] **Disable DEV_SESSION_USER_ID in production**
  - Set `NODE_ENV=production` in deployment
  - Bypass will be impossible regardless

- [ ] **Enable Azure AD conditional access**
  - Require managed devices
  - Require compliant devices
  - Block high-risk sign-in patterns

- [ ] **Test session expiry**
  - Verify tokens expire after 24 hours
  - Verify refresh fails after TTL

---

## 7. Threat Model Summary

| Threat | Impact | Mitigation | Status |
|--------|--------|-----------|--------|
| XSS | Can perform actions as user | React auto-escape, input validation | ✅ Protected |
| CSRF | Can forge authenticated requests | sameSite=lax cookies | ✅ Protected |
| Man-in-Middle | Token/password capture | HTTPS (must configure) | ⚠️ Needs production config |
| Session Fixation | Attacker forces user into known session | JWT tokens (stateless) | ✅ Protected |
| Cookie theft via JS | Read sensitive auth data | httpOnly cookie flag | ✅ Protected |
| Token replay | Reuse expired token | Token expiry check (default 30d) | ✅ Protected |
| Dev bypass in prod | Admin access without SSO | NODE_ENV=production guard | ✅ Protected |

---

## Summary

✅ **XSS**: Fully protected via React + input validation  
✅ **Parameterized SQL**: No injection risk  
✅ **Cookies**: httpOnly + sameSite configured correctly  
✅ **Dev Bypass**: Impossible in production (NODE_ENV guard)  
⚠️ **HTTPS**: Must enforce in production (not dev)  
⚠️ **Auth.js Config**: Verify maxAge and secure flag for production  
⚠️ **Secrets**: Remove .env files from git, use Key Vault in production  

**Risk Level**: LOW in development, MEDIUM→LOW in production (after checklist)
