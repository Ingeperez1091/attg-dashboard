import { headers } from "next/headers";

/**
 * Builds a Request using inbound server headers so auth helpers can resolve
 * both NextAuth session context and dev/local fallback credentials.
 *
 * When called outside a Next.js request scope (e.g. in integration tests),
 * returns a bare Request with no headers rather than throwing.
 */
export async function createServerRequest(url = "http://internal.local/"): Promise<Request> {
  let headerStore: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    headerStore = await headers();
  } catch {
    // Outside request scope (unit/integration tests) — return bare request.
    return new Request(url);
  }

  const requestHeaders = new Headers();

  const cookieHeader = headerStore.get("cookie");
  if (cookieHeader) {
    requestHeaders.set("Cookie", cookieHeader);
  }

  const authorizationHeader = headerStore.get("authorization");
  if (authorizationHeader) {
    requestHeaders.set("Authorization", authorizationHeader);
  }

  const requestIdHeader = headerStore.get("x-request-id");
  if (requestIdHeader) {
    requestHeaders.set("x-request-id", requestIdHeader);
  }

  return new Request(url, { headers: requestHeaders });
}