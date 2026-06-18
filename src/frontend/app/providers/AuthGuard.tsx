"use client";

import { useEffect, ReactNode } from "react";
import { useSession } from "@/lib/auth/useSession";

interface AuthGuardProps {
  children: ReactNode;
  requiredRole?: string;
}

/**
 * Client-side auth guard for protected pages.
 * Redirects to /login if no session is available in sessionStorage.
 * Use this to wrap page content that requires authentication.
 */
export function AuthGuard({ children, requiredRole }: Readonly<AuthGuardProps>) {
  const { session, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      const returnUrl = `${globalThis.location.pathname}${globalThis.location.search}`;
      globalThis.location.href = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
      return;
    }

    if (!session.isActive) {
      globalThis.location.href = "/login?reason=inactive";
      return;
    }

    if (requiredRole && session.role !== requiredRole && session.role !== "administrator") {
      globalThis.location.href = "/dashboard";
    }
  }, [session, loading, requiredRole]);

  if (loading) {
    return <div className="auth-guard-loading">Loading...</div>;
  }

  if (!session?.isActive) {
    return null;
  }

  if (requiredRole && session.role !== requiredRole && session.role !== "administrator") {
    return null;
  }

  return <>{children}</>;
}
