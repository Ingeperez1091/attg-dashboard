import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { validateRuntimeSecurityConfig } from "@/lib/security/runtime-security";

validateRuntimeSecurityConfig();

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: true,
  trustHost: true, // 👈 IMPORTANT
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
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        // In production (Azure App Service with HTTPS): must be true
        // In development (localhost): false is safe
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const profileRecord = profile as Record<string, unknown>;
        const oid = firstString(profileRecord.oid);
        if (oid) {
          token.oid = oid;
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

    async redirect({ baseUrl }) {
      // Siempre redirige al dashboard después de login
      return `${baseUrl}/dashboard`;
    },
  },
});
