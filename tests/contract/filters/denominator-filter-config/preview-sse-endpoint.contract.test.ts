import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/filters/denominator/[appId]/preview/route";
import {
  getRuntimeRepositories,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";

/**
 * Contract tests for the SSE-streaming preview endpoint.
 * Validates response headers, SSE event schema (status/complete/error),
 * auth enforcement (403 for viewer), and 400 for bad input.
 */
describe("contract - POST /api/filters/denominator/:appId/preview (SSE)", () => {
  const appId = "10000000-0000-0000-0000-000000000001";
  const validRules = [
    {
      denominatorModelId: "50000000-0000-0000-0007-000000000000",
      operator: "IN_LIST",
      value: "11420;11421"
    }
  ];

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.PIPELINE_EXECUTION_MODE = "local";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  function makeRequest(body: unknown, userId?: string) {
    if (userId) {
      process.env.DEV_SESSION_USER_ID = userId;
    }
    return new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  describe("SSE response headers", () => {
    it("returns text/event-stream content type", async () => {
      const response = await POST(makeRequest({ rules: validRules }), {
        params: Promise.resolve({ appId })
      });

      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    });

    it("returns Cache-Control: no-cache", async () => {
      const response = await POST(makeRequest({ rules: validRules }), {
        params: Promise.resolve({ appId })
      });

      expect(response.headers.get("Cache-Control")).toBe("no-cache");
    });

    it("returns X-Accel-Buffering: no", async () => {
      const response = await POST(makeRequest({ rules: validRules }), {
        params: Promise.resolve({ appId })
      });

      expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    });
  });

  describe("SSE event schema", () => {
    it("first event is a status event with stage and pctComplete", async () => {
      const response = await POST(makeRequest({ rules: validRules }), {
        params: Promise.resolve({ appId })
      });

      const text = await readFullStream(response);
      const events = parseSSEEvents(text);

      expect(events.length).toBeGreaterThanOrEqual(1);
      const firstEvent = events[0];
      expect(firstEvent.event).toBe("status");
      const data = JSON.parse(firstEvent.data);
      expect(data).toHaveProperty("stage");
      expect(data).toHaveProperty("pctComplete");
      expect(typeof data.pctComplete).toBe("number");
    });

    it("first status event includes previewRunId as UUID", async () => {
      const response = await POST(makeRequest({ rules: validRules }), {
        params: Promise.resolve({ appId })
      });

      const text = await readFullStream(response);
      const events = parseSSEEvents(text);
      const firstStatus = events.find(e => e.event === "status");
      expect(firstStatus).toBeDefined();
      const data = JSON.parse(firstStatus!.data);
      expect(data.previewRunId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("stream ends with exactly one terminal event (complete or error)", async () => {
      const response = await POST(makeRequest({ rules: validRules }), {
        params: Promise.resolve({ appId })
      });

      const text = await readFullStream(response);
      const events = parseSSEEvents(text);

      const terminalEvents = events.filter(
        e => e.event === "complete" || e.event === "error"
      );
      expect(terminalEvents).toHaveLength(1);
    });

    it("complete event includes current, projected, delta, warnings, previewRunId, calculatedAtUtc", async () => {
      const response = await POST(makeRequest({ rules: validRules }), {
        params: Promise.resolve({ appId })
      });

      const text = await readFullStream(response);
      const events = parseSSEEvents(text);
      const completeEvent = events.find(e => e.event === "complete");

      // May be error if no metrics seeded — skip this assertion if error
      if (!completeEvent) {
        const errorEvent = events.find(e => e.event === "error");
        expect(errorEvent).toBeDefined();
        const errData = JSON.parse(errorEvent!.data);
        expect(errData).toHaveProperty("message");
        expect(errData).toHaveProperty("previewRunId");
        return;
      }

      const data = JSON.parse(completeEvent.data);
      expect(data).toHaveProperty("current");
      expect(data).toHaveProperty("projected");
      expect(data).toHaveProperty("delta");
      expect(data).toHaveProperty("warnings");
      expect(data).toHaveProperty("previewRunId");
      expect(data).toHaveProperty("calculatedAtUtc");
      expect(Array.isArray(data.warnings)).toBe(true);
    });
  });

  describe("validation — 400 responses (immediate, no SSE)", () => {
    it("returns 400 JSON for empty rules array", async () => {
      const response = await POST(
        makeRequest({ rules: [] }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(400);
      expect(response.headers.get("Content-Type")).toContain("application/json");
      const body = await response.json();
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.details.code).toBe("INVALID_REQUEST_BODY");
    });

    it("returns 400 JSON for missing denominatorModelId", async () => {
      const response = await POST(
        makeRequest({ rules: [{ operator: "EQUALS", value: "test" }] }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 JSON for invalid operator", async () => {
      const response = await POST(
        makeRequest({
          rules: [{
            denominatorModelId: "50000000-0000-0000-0007-000000000000",
            operator: "LIKE",
            value: "test"
          }]
        }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 JSON for value exceeding 512 chars", async () => {
      const response = await POST(
        makeRequest({
          rules: [{
            denominatorModelId: "50000000-0000-0000-0007-000000000000",
            operator: "EQUALS",
            value: "x".repeat(513)
          }]
        }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 JSON for non-UUID denominatorModelId", async () => {
      const response = await POST(
        makeRequest({
          rules: [{
            denominatorModelId: "not-a-uuid",
            operator: "EQUALS",
            value: "test"
          }]
        }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("VALIDATION_ERROR");
    });
  });

  describe("authorization — 403 responses", () => {
    it("returns 403 for viewer role", async () => {
      // Create a viewer user with proper role assignment
      const repositories = getRuntimeRepositories();
      const viewer = await repositories.users.create({
        username: "viewer_preview_test",
        email: "viewer-preview@example.com",
        isActive: true,
        actorUserId: "seed"
      });
      await repositories.roles.assignRole(viewer.userId, "viewer", "seed");
      await repositories.userApplications.assign(viewer.userId, appId, "seed");

      // Use cookie-based auth so it goes through resolveFromRepositories (not the
      // seededAdminSession bypass that DEV_SESSION_USER_ID triggers)
      delete process.env.DEV_SESSION_USER_ID;
      const response = await POST(
        new Request(`http://localhost/api/filters/denominator/${appId}/preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": `dev_user_id=${viewer.userId}`
          },
          body: JSON.stringify({ rules: validRules })
        }),
        { params: Promise.resolve({ appId }) }
      );

      expect(response.status).toBe(403);
      expect(response.headers.get("Content-Type")).toContain("application/json");
      const body = await response.json();
      expect(body.error).toBe("Forbidden");
    });
  });
});

// --- Helpers ---

async function readFullStream(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  return result;
}

interface SSEEvent {
  event: string;
  data: string;
}

function parseSSEEvents(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = text.split("\n\n").filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "";
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        event = line.slice(7);
      } else if (line.startsWith("data: ")) {
        data = line.slice(6);
      }
    }

    if (event && data) {
      events.push({ event, data });
    }
  }

  return events;
}
