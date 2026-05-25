import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn()
}));

import { createServerRequest } from "@/lib/auth/server-request";
import { headers } from "next/headers";

const mockedHeaders = vi.mocked(headers);

describe("server-request - createServerRequest branches", () => {
  it("forwards cookie header when present", async () => {
    mockedHeaders.mockResolvedValue(
      new Map([["cookie", "session=abc123"]]) as unknown as Awaited<ReturnType<typeof headers>>
    );

    const request = await createServerRequest();
    expect(request.headers.get("Cookie")).toBe("session=abc123");
  });

  it("forwards authorization header when present", async () => {
    mockedHeaders.mockResolvedValue(
      new Map([["authorization", "Bearer token123"]]) as unknown as Awaited<ReturnType<typeof headers>>
    );

    const request = await createServerRequest();
    expect(request.headers.get("Authorization")).toBe("Bearer token123");
  });

  it("forwards x-request-id header when present", async () => {
    mockedHeaders.mockResolvedValue(
      new Map([["x-request-id", "req-uuid-123"]]) as unknown as Awaited<ReturnType<typeof headers>>
    );

    const request = await createServerRequest();
    expect(request.headers.get("x-request-id")).toBe("req-uuid-123");
  });

  it("omits headers that are not present", async () => {
    mockedHeaders.mockResolvedValue(
      new Map() as unknown as Awaited<ReturnType<typeof headers>>
    );

    const request = await createServerRequest("http://custom.local/test");
    expect(request.headers.get("Cookie")).toBeNull();
    expect(request.headers.get("Authorization")).toBeNull();
    expect(request.headers.get("x-request-id")).toBeNull();
    expect(request.url).toBe("http://custom.local/test");
  });

  it("forwards all headers when all are present", async () => {
    mockedHeaders.mockResolvedValue(
      new Map([
        ["cookie", "dev_user_id=user-1"],
        ["authorization", "Bearer xyz"],
        ["x-request-id", "trace-001"]
      ]) as unknown as Awaited<ReturnType<typeof headers>>
    );

    const request = await createServerRequest();
    expect(request.headers.get("Cookie")).toBe("dev_user_id=user-1");
    expect(request.headers.get("Authorization")).toBe("Bearer xyz");
    expect(request.headers.get("x-request-id")).toBe("trace-001");
  });
});
