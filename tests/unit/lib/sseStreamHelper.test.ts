import { describe, it, expect } from "vitest";
import {
  encodeSSEEvent,
  createSSEStream,
  SSE_HEADERS,
  SSEStatusPayload,
  SSECompletePayload,
  SSEErrorPayload,
  MetricsSummary
} from "@/lib/sse/sseStreamHelper";

describe("encodeSSEEvent", () => {
  it("formats a status event with event type and JSON data", () => {
    const payload: SSEStatusPayload = { stage: "processing", pctComplete: 50 };
    const result = encodeSSEEvent("status", payload);
    expect(result).toBe(
      `event: status\ndata: ${JSON.stringify(payload)}\n\n`
    );
  });

  it("formats a complete event", () => {
    const metrics: MetricsSummary = {
      adoptionPct: 42.3,
      revenueSharePct: 38.1,
      matchedCount: 1247,
      denominatorCount: 2948,
      denominatorRevenue: 48200000
    };
    const payload: SSECompletePayload = {
      current: metrics,
      projected: { ...metrics, adoptionPct: 58.7 },
      delta: { ...metrics, adoptionPct: 16.4 },
      warnings: [],
      previewRunId: "run-1",
      calculatedAtUtc: "2026-06-14T14:30:00.000Z"
    };
    const result = encodeSSEEvent("complete", payload);
    expect(result).toMatch(/^event: complete\ndata: /);
    expect(result.endsWith("\n\n")).toBe(true);
  });

  it("formats an error event", () => {
    const payload: SSEErrorPayload = { message: "Failed", previewRunId: "run-1" };
    const result = encodeSSEEvent("error", payload);
    expect(result).toBe(
      `event: error\ndata: ${JSON.stringify(payload)}\n\n`
    );
  });

  it("escapes special characters in JSON data", () => {
    const payload = { stage: "line\nbreak", pctComplete: 0 };
    const result = encodeSSEEvent("status", payload);
    // JSON.stringify escapes \n as \\n within the data field
    expect(result).not.toContain("data: {\"stage\":\"line\nbreak\"");
    expect(result).toContain(String.raw`\n`);
  });
});

describe("SSE_HEADERS", () => {
  it("includes required headers for SSE streaming", () => {
    expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
    expect(SSE_HEADERS["Cache-Control"]).toBe("no-cache");
    expect(SSE_HEADERS["Connection"]).toBe("keep-alive");
    expect(SSE_HEADERS["X-Accel-Buffering"]).toBe("no");
  });
});

describe("createSSEStream", () => {
  it("returns a ReadableStream and controller", () => {
    const { stream, controller } = createSSEStream();
    expect(stream).toBeInstanceOf(ReadableStream);
    expect(controller).toHaveProperty("sendStatus");
    expect(controller).toHaveProperty("sendComplete");
    expect(controller).toHaveProperty("sendError");
    expect(controller).toHaveProperty("close");
  });

  it("emits status events as encoded UTF-8 chunks", async () => {
    const { stream, controller } = createSSEStream();
    const reader = stream.getReader();

    controller.sendStatus({ stage: "queued", pctComplete: 0, previewRunId: "run-1" });
    controller.close();

    const { value, done } = await reader.read();
    expect(done).toBe(false);
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: status");
    expect(text).toContain("\"stage\":\"queued\"");
    expect(text).toContain("\"previewRunId\":\"run-1\"");

    const final = await reader.read();
    expect(final.done).toBe(true);
  });

  it("emits complete event and closes stream", async () => {
    const { stream, controller } = createSSEStream();
    const reader = stream.getReader();

    const metrics: MetricsSummary = {
      adoptionPct: 50,
      revenueSharePct: 40,
      matchedCount: 100,
      denominatorCount: 200,
      denominatorRevenue: 1000000
    };

    controller.sendComplete({
      current: metrics,
      projected: metrics,
      delta: { adoptionPct: 0, revenueSharePct: 0, matchedCount: 0, denominatorCount: 0, denominatorRevenue: 0 },
      warnings: [],
      previewRunId: "run-2",
      calculatedAtUtc: "2026-06-14T00:00:00.000Z"
    });

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: complete");

    const final = await reader.read();
    expect(final.done).toBe(true);
  });

  it("emits error event and closes stream", async () => {
    const { stream, controller } = createSSEStream();
    const reader = stream.getReader();

    controller.sendError({ message: "Pipeline failed", previewRunId: "run-3" });

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: error");
    expect(text).toContain("Pipeline failed");

    const final = await reader.read();
    expect(final.done).toBe(true);
  });

  it("sends multiple status events in sequence before complete", async () => {
    const { stream, controller } = createSSEStream();
    const reader = stream.getReader();

    controller.sendStatus({ stage: "queued", pctComplete: 0, previewRunId: "run-4" });
    controller.sendStatus({ stage: "processing", pctComplete: 25 });
    controller.sendStatus({ stage: "calculating_metrics", pctComplete: 75 });
    controller.sendComplete({
      current: { adoptionPct: 42, revenueSharePct: 38, matchedCount: 100, denominatorCount: 200, denominatorRevenue: 5000000 },
      projected: { adoptionPct: 58, revenueSharePct: 51, matchedCount: 100, denominatorCount: 150, denominatorRevenue: 3500000 },
      delta: { adoptionPct: 16, revenueSharePct: 13, matchedCount: 0, denominatorCount: -50, denominatorRevenue: -1500000 },
      warnings: ["Denominator reduced by 25%"],
      previewRunId: "run-4",
      calculatedAtUtc: "2026-06-14T12:00:00.000Z"
    });

    const chunks: string[] = [];
    let result = await reader.read();
    while (!result.done) {
      chunks.push(new TextDecoder().decode(result.value));
      result = await reader.read();
    }

    const fullText = chunks.join("");
    expect(fullText).toContain("\"stage\":\"queued\"");
    expect(fullText).toContain("\"stage\":\"processing\"");
    expect(fullText).toContain("\"stage\":\"calculating_metrics\"");
    expect(fullText).toContain("event: complete");
  });

  it("close() closes the stream without emitting an event", async () => {
    const { stream, controller } = createSSEStream();
    const reader = stream.getReader();

    controller.close();

    const result = await reader.read();
    expect(result.done).toBe(true);
  });
});
