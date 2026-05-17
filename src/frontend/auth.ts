import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { validateRuntimeSecurityConfig } from "@/lib/security/runtime-security";
import { appBootTrace } from "@/lib/runtime-trace";

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
    .replace(/-/g, "+")
    .replace(/_/g, "/")
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.AUTH_DEBUG_SSO === "true",
  trustHost: true, // 👈 IMPORTANT
  useSecureCookies,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // 24-hour session expiry (production should verify this is appropriate)
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, profile, account, user }) {
      const tokenRecord = token as Record<string, unknown>;
      const accountRecord = account as Record<string, unknown> | null;

      if (profile) {
        const profileRecord = profile as Record<string, unknown>;
        // Entra commonly exposes oid; some flows expose only sub.
        const oid = firstString(profileRecord.oid, profileRecord.sub);
        if (oid) {
          tokenRecord.oid = oid;
        }

        // Some Entra tenants do not emit the "email" claim; use common fallbacks.
        if (typeof token.email !== "string" || !token.email.trim()) {
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
      }

      // Profile can be absent on some callback paths under IIS/proxy setups.
      // Fall back to durable token/account claims so session resolution still works.
      if (typeof tokenRecord.oid !== "string" || !tokenRecord.oid.trim()) {
        const resolvedOid = firstString(token.sub, account?.providerAccountId);
        if (resolvedOid) {
          tokenRecord.oid = resolvedOid;
        }
      }

      if (typeof token.email !== "string" || !token.email.trim()) {
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

      // Some IIS/proxy callback paths do not surface profile claims reliably.
      // As a final fallback, parse id_token payload claims from the provider account.
      if (
        (typeof tokenRecord.oid !== "string" || !tokenRecord.oid.trim()) ||
        (typeof token.email !== "string" || !token.email.trim())
      ) {
        const idToken = firstString(accountRecord?.id_token, tokenRecord.id_token);
        const idTokenPayload = parseJwtPayload(idToken);
        if (idTokenPayload) {
          const payloadOid = firstString(
            idTokenPayload.oid,
            idTokenPayload.sub,
            idTokenPayload.objectid,
          );

          if ((typeof tokenRecord.oid !== "string" || !tokenRecord.oid.trim()) && payloadOid) {
            tokenRecord.oid = payloadOid;
          }

          if (typeof token.email !== "string" || !token.email.trim()) {
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
