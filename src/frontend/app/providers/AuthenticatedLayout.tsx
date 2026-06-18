"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "./AuthGuard";

/**
 * Wraps children with AuthGuard on all routes except /login.
 * This ensures pages require a valid sessionStorage token to render.
 */
export function AuthenticatedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return <AuthGuard>{children}</AuthGuard>;
}
