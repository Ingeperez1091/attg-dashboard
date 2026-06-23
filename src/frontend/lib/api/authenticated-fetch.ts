/**
 * Authenticated fetch wrapper for client-side API calls.
 * Attaches the Bearer token from sessionStorage to every request,
 * eliminating reliance on Auth.js cookies that WAF may block.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  // Attach Bearer token from sessionStorage
  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  // If we get a 401, the token may be expired — redirect to login
  if (response.status === 401) {
    clearStoredSession();
    const returnUrl = `${globalThis.location.pathname}${globalThis.location.search}`;
    globalThis.location.href = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
    throw new Error("UNAUTHORIZED");
  }

  return response;
}

function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem("attg_session_token");
  } catch {
    return null;
  }
}

function clearStoredSession(): void {
  try {
    sessionStorage.removeItem("attg_session_token");
    sessionStorage.removeItem("attg_session_user");
  } catch {
    // sessionStorage not available
  }
}
