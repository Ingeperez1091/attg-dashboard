"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, ReactNode } from "react";

export interface SessionInfo {
  token: string;
  userId: string;
  role: string;
  isActive: boolean;
  email: string | null;
}

export interface SessionContextValue {
  session: SessionInfo | null;
  loading: boolean;
  clearSession: () => void;
}

const STORAGE_KEY = "attg_session_token";

export const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  clearSession: () => {},
});


function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSession(token: string): void {
  sessionStorage.setItem(STORAGE_KEY, token);
}

function clearStoredSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Acquires a session token from the server by exchanging the Auth.js session cookie.
 * The cookie is scoped to /api/auth path so it's only sent to this endpoint,
 * not on page navigations (avoiding WAF issues).
 */
async function acquireViaSessionCookie(): Promise<SessionInfo | null> {
  try {
    const res = await fetch("/api/auth/session-token", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.token || !data.user) return null;

    storeSession(data.token);
    return {
      token: data.token,
      userId: data.user.userId,
      role: data.user.role,
      isActive: data.user.isActive,
      email: data.user.email,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies an existing stored token by calling a lightweight server endpoint.
 * Returns the session info if the token is still valid, null otherwise.
 */
async function verifyStoredToken(token: string): Promise<SessionInfo | null> {
  try {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.user) return null;

    return {
      token,
      userId: data.user.userId,
      role: data.user.role,
      isActive: data.user.isActive,
      email: data.user.email,
    };
  } catch {
    return null;
  }
}

/**
 * Refreshes the token: sends the current Bearer token and receives a fresh one.
 */
async function refreshToken(currentToken: string): Promise<SessionInfo | null> {
  try {
    const res = await fetch("/api/auth/verify?refresh=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.user) return null;

    if (data.token) {
      storeSession(data.token);
      return {
        token: data.token,
        userId: data.user.userId,
        role: data.user.role,
        isActive: data.user.isActive,
        email: data.user.email,
      };
    }

    return {
      token: currentToken,
      userId: data.user.userId,
      role: data.user.role,
      isActive: data.user.isActive,
      email: data.user.email,
    };
  } catch {
    return null;
  }
}

/**
 * Installs a global fetch interceptor that automatically attaches the Bearer token
 * from sessionStorage to all same-origin /api/ requests (except /api/auth/).
 */
function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

function installFetchInterceptor(): () => void {
  // If already frozen from a prior mount (React Strict Mode double-mount, HMR),
  // skip re-installation — the interceptor is permanent for the tab's lifetime.
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  if (descriptor && !descriptor.configurable) {
    return () => {};
  }

  const originalFetch = globalThis.fetch;

  function interceptedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = resolveUrl(input);

    const isApiCall = url.startsWith("/api/") || (url.startsWith(globalThis.location.origin) && new URL(url).pathname.startsWith("/api/"));
    const isAuthRoute = url.includes("/api/auth/");

    if (isApiCall && !isAuthRoute) {
      const token = sessionStorage.getItem(STORAGE_KEY);
      if (token) {
        const headers = new Headers(init?.headers);
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    }

    return originalFetch(input, init);
  }

  Object.defineProperty(globalThis, "fetch", {
    value: interceptedFetch,
    writable: false,
    configurable: false,
  });

  // Cleanup is a no-op — the frozen interceptor lives for the tab's lifetime.
  // React Strict Mode re-mount and HMR are handled by the descriptor check above.
  return () => {};
}

export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uninstall = installFetchInterceptor();

    async function initSession(): Promise<void> {
      // Priority 1: Validate existing stored token
      const storedToken = getStoredToken();
      if (storedToken) {
        const info = await verifyStoredToken(storedToken);
        if (info) {
          setSession(info);
          setLoading(false);
          return;
        }
        // Token invalid/expired — clear it and try cookie
        clearStoredSession();
      }

      // Priority 2: Exchange session cookie for a Bearer token
      // (works right after OAuth callback since cookie is scoped to /api/auth)
      const acquired = await acquireViaSessionCookie();
      if (acquired) {
        setSession(acquired);
      }
      setLoading(false);
    }

    initSession();

    return uninstall;
  }, []);

  // Silent refresh: re-issue a fresh token before the current one expires.
  // Token TTL is 15 min; refresh every 10 min so there's always a valid token.
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session) return;

    const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

    refreshInterval.current = setInterval(async () => {
      const currentToken = getStoredToken();
      if (!currentToken) {
        clearStoredSession();
        setSession(null);
        return;
      }
      const refreshed = await refreshToken(currentToken);
      if (refreshed) {
        setSession(refreshed);
      } else {
        clearStoredSession();
        setSession(null);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
    };
  }, [session?.userId]);

  const clearSession = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  const contextValue = useMemo<SessionContextValue>(
    () => ({ session, loading, clearSession }),
    [session, loading, clearSession],
  );

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}
