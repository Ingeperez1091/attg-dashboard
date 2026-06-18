"use client";

import { useContext } from "react";
import { SessionContext, SessionContextValue } from "@/app/providers/SessionProvider";

/**
 * Hook to access session state from sessionStorage.
 * Returns the session token, user info, and loading state.
 */
export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

/**
 * Returns the Bearer token from sessionStorage (for use in fetch calls).
 * Returns null if not authenticated.
 */
export function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem("attg_session_token");
  } catch {
    return null;
  }
}
