import { signIn } from "@/auth";
import { isDevBypassEnabled } from "@/lib/auth/dev-bypass";
import { cookies } from "next/headers";

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function getReturnUrl(rawValue: string | string[] | undefined): string {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps): Promise<JSX.Element> {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const returnUrl = getReturnUrl(resolvedSearchParams?.returnUrl);
  const errorCode = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const isLocalDev = process.env.NODE_ENV !== "production";
  const devBypassEnabled = isDevBypassEnabled();
  const cookieStore = await cookies();
  const devBypassUserId = isLocalDev ? cookieStore.get("dev_user_id")?.value : undefined;

  async function signInWithMicrosoft(): Promise<void> {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: returnUrl });
  }

  return (
    <main style={{ maxWidth: "480px", margin: "64px auto", padding: "0 16px" }}>
      <h1>Sign in</h1>
      <p>Use your Microsoft Entra ID account to access the dashboard.</p>

      {isLocalDev && devBypassEnabled && devBypassUserId ? (
        <p style={{ color: "#0f5132", background: "#d1e7dd", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.9rem" }}>
          Dev bypass is active for user: {devBypassUserId}
        </p>
      ) : null}

      {errorCode ? (
        <p style={{ color: "#b42318", fontSize: "0.9rem" }}>
          Login failed: {errorCode}
        </p>
      ) : null}

      <form action={signInWithMicrosoft}>
        <button type="submit" className="btn btn--primary" aria-live="polite">
          Sign in with Microsoft Entra ID
        </button>
      </form>

      {isLocalDev && devBypassEnabled ? (
        <section style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--app-border)" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Local Dev Bypass</h2>
          <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
            Enter a registered database account (email, username, or userId) to bypass SSO in local development.
          </p>
          <form action="/api/auth/dev-login" method="post">
            <input type="hidden" name="returnUrl" value={returnUrl} />
            <label htmlFor="dev-identifier" style={{ display: "block", marginBottom: "0.25rem" }}>
              Account Identifier
            </label>
            <input
              id="dev-identifier"
              name="identifier"
              type="text"
              className="form-input"
              placeholder="email, username, or userId"
              required
              style={{ marginBottom: "0.75rem" }}
            />
            <button type="submit" className="btn btn--primary">Login (Dev Only)</button>
          </form>

          <form action="/api/auth/dev-logout" method="post" style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="returnUrl" value="/login" />
            <button type="submit" className="btn btn--outline">Logout (Dev)</button>
          </form>
        </section>
      ) : null}
    </main>
  );
}