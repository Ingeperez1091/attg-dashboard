import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { validateRuntimeSecurityConfig } from "@/lib/security/runtime-security";
import { appBootTrace } from "@/lib/runtime-trace";
import { createAuthCode } from "@/lib/auth/auth-code-store";

validateRuntimeSecurityConfig();

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function shouldUseSecureCookies(): boolean {
  const authUrl = process.env.AUTH_URL?.trim();
  if (authUrl) {
    return authUrl.toLowerCase().startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}

const useSecureCookies = shouldUseSecureCookies();

function parseJwtPayload(jwt: string | null | undefined): Record<string, unknown> | null {
  if (!jwt) {
    return null;
  }

  const parts = jwt.split(".");
  if (parts.length < 2) {
    return null;
  }

  const payload = parts[1]
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

  try {
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function hasNoString(value: unknown): boolean {
  return typeof value !== "string" || !String(value).trim();
}

function resolveOidFromProfile(tokenRecord: Record<string, unknown>, profile: unknown): void {
  if (!profile) return;
  const profileRecord = profile as Record<string, unknown>;
  const oid = firstString(profileRecord.oid, profileRecord.sub);
  if (oid) {
    tokenRecord.oid = oid;
  }
}

function resolveEmailFromProfile(token: Record<string, unknown>, profile: unknown): void {
  if (!profile) return;
  if (!hasNoString(token.email)) return;
  const profileRecord = profile as Record<string, unknown>;
  const resolvedEmail = firstString(
    profileRecord.email,
    profileRecord.preferred_username,
    profileRecord.upn,
    profileRecord.unique_name,
  );
  if (resolvedEmail) {
    token.email = resolvedEmail.toLowerCase();
  }
}

function resolveOidFallback(
  tokenRecord: Record<string, unknown>,
  token: Record<string, unknown>,
  account: { providerAccountId?: string } | null | undefined,
): void {
  if (!hasNoString(tokenRecord.oid)) return;
  const resolvedOid = firstString(token.sub, account?.providerAccountId);
  if (resolvedOid) {
    tokenRecord.oid = resolvedOid;
  }
}

function resolveEmailFallback(
  token: Record<string, unknown>,
  tokenRecord: Record<string, unknown>,
  user: { email?: string | null } | undefined,
): void {
  if (!hasNoString(token.email)) return;
  const resolvedEmail = firstString(
    user?.email,
    token.email,
    tokenRecord.preferred_username,
    tokenRecord.upn,
    tokenRecord.unique_name,
  );
  if (resolvedEmail) {
    token.email = resolvedEmail.toLowerCase();
  }
}

function resolveFromIdToken(
  tokenRecord: Record<string, unknown>,
  token: Record<string, unknown>,
  accountRecord: Record<string, unknown> | null,
): void {
  if (!hasNoString(tokenRecord.oid) && !hasNoString(token.email)) return;

  const idToken = firstString(accountRecord?.id_token, tokenRecord.id_token);
  const idTokenPayload = parseJwtPayload(idToken);
  if (!idTokenPayload) return;

  if (hasNoString(tokenRecord.oid)) {
    const payloadOid = firstString(idTokenPayload.oid, idTokenPayload.sub, idTokenPayload.objectid);
    if (payloadOid) {
      tokenRecord.oid = payloadOid;
    }
  }

  if (hasNoString(token.email)) {
    const payloadEmail = firstString(
      idTokenPayload.email,
      idTokenPayload.preferred_username,
      idTokenPayload.upn,
      idTokenPayload.unique_name,
    );
    if (payloadEmail) {
      token.email = payloadEmail.toLowerCase();
    }
  }
}

// Request-scoped: holds the one-time auth code generated during the jwt callback
// so it can be appended to the final redirect URL.
let pendingAuthCode: string | null = null;

/**
 * Consumes the pending auth code (if any) generated during the current request's jwt callback.
 * Returns the code and resets the module state. Called by the [...nextauth] route handler.
 */
export function consumePendingAuthCode(): string | null {
  const code = pendingAuthCode;
  pendingAuthCode = null;
  return code;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.AUTH_DEBUG_SSO === "true",
  trustHost: true, // 👈 IMPORTANT
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: useSecureCookies ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/api/auth",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: useSecureCookies ? "__Secure-authjs.callback-url" : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/api/auth",
        secure: useSecureCookies,
        maxAge: 120,
      },
    },
    csrfToken: {
      name: useSecureCookies ? "__Secure-authjs.csrf-token" : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/api/auth",
        secure: useSecureCookies,
        maxAge: 120,
      },
    },
  },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      authorization: {
        params: {
          response_mode: "query",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // Session cookie supports server-side page rendering (auth() calls).
    // Client-side uses Bearer tokens from sessionStorage (15-min TTL, refreshed every 10 min).
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, profile, account, user }) {
      const tokenRecord = token as Record<string, unknown>;
      const accountRecord = account as Record<string, unknown> | null;

      resolveOidFromProfile(tokenRecord, profile);
      resolveEmailFromProfile(token, profile);
      resolveOidFallback(tokenRecord, token, account);
      resolveEmailFallback(token, tokenRecord, user);
      resolveFromIdToken(tokenRecord, token, accountRecord);

      // On initial sign-in (account is present), generate a one-time auth code
      // so the client can exchange it for a Bearer token without needing cookies.
      if (account) {
        const oid = typeof tokenRecord.oid === "string" ? tokenRecord.oid : null;
        const email = typeof token.email === "string" ? token.email : null;
        pendingAuthCode = createAuthCode({ oid, email });
      }

      return token;
    },
    async session({ session, token }) {
      if (typeof token.oid === "string") {
        (session as { oid?: string }).oid = token.oid;
      }

      if (typeof token.email === "string" && token.email.trim()) {
        const mutableSession = session as { user?: { email?: string } };
        mutableSession.user ??= {};
        mutableSession.user.email = token.email.toLowerCase();
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      // Keep Auth.js default redirect safety semantics and only coerce
      // same-origin root to /dashboard.
      let resolved = baseUrl;

      if (url.startsWith("/")) {
        resolved = `${baseUrl}${url}`;
      } else {
        try {
          const target = new URL(url);
          if (target.origin === baseUrl) {
            resolved = url;
          }
        } catch {
          resolved = baseUrl;
        }
      }

      try {
        const resolvedUrl = new URL(resolved);
        if (resolvedUrl.origin === baseUrl && resolvedUrl.pathname === "/") {
          resolved = `${baseUrl}/dashboard`;
        }
      } catch {
        resolved = baseUrl;
      }

      appBootTrace("auth:redirect", {
        url,
        baseUrl,
        resolved,
      });

      return resolved;
    },
  },
  events: {
    async signIn(message) {
      appBootTrace("auth:event:signIn", {
        provider: message.account?.provider,
        type: message.account?.type,
        userId: message.user?.id,
        isNewUser: message.isNewUser,
      });
    },
  },
});
