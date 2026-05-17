import { headers } from "next/headers";

/**
 * Builds a Request using inbound server headers so auth helpers can resolve
 * both NextAuth session context and dev/local fallback credentials.
 */
export async function createServerRequest(url = "http://internal.local/"): Promise<Request> {
  const headerStore = await headers();
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