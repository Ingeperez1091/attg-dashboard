/**
 * SSE Stream Helper — ReadableStream encoder for Server-Sent Events.
 *
 * Implements the text/event-stream protocol with proper headers for
 * proxy/CDN compatibility (X-Accel-Buffering: no, Cache-Control: no-cache).
 */

export type SSEEventType = "status" | "complete" | "error";

export interface SSEStatusPayload {
  stage: string;
  pctComplete: number;
  previewRunId?: string;
}

export interface SSECompletePayload {
  current: MetricsSummary;
  projected: MetricsSummary;
  delta: MetricsSummary;
  warnings: string[];
  previewRunId: string;
  calculatedAtUtc: string;
}

export interface SSEErrorPayload {
  message: string;
  previewRunId: string;
}

export interface MetricsSummary {
  adoptionPct: number;
  revenueSharePct: number;
  matchedCount: number;
  denominatorCount: number;
  denominatorRevenue: number;
}

/**
 * Encode a single SSE event as a UTF-8 string.
 */
export function encodeSSEEvent(eventType: SSEEventType, data: unknown): string {
  const json = JSON.stringify(data);
  return `event: ${eventType}\ndata: ${json}\n\n`;
}

/**
 * Headers required for an SSE response that prevents proxy buffering.
 */
export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

export type SSEStreamController = {
  sendStatus: (payload: SSEStatusPayload) => void;
  sendComplete: (payload: SSECompletePayload) => void;
  sendError: (payload: SSEErrorPayload) => void;
  close: () => void;
};

/**
 * Create a ReadableStream that emits SSE events.
 * Returns the stream and a controller object to push events.
 */
export function createSSEStream(): {
  stream: ReadableStream<Uint8Array>;
  controller: SSEStreamController;
} {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      streamController = c;
    },
  });

  function enqueue(eventType: SSEEventType, data: unknown): void {
    if (!streamController) return;
    const encoded = encoder.encode(encodeSSEEvent(eventType, data));
    streamController.enqueue(encoded);
  }

  const controller: SSEStreamController = {
    sendStatus(payload: SSEStatusPayload) {
      enqueue("status", payload);
    },
    sendComplete(payload: SSECompletePayload) {
      enqueue("complete", payload);
      streamController?.close();
      streamController = null;
    },
    sendError(payload: SSEErrorPayload) {
      enqueue("error", payload);
      streamController?.close();
      streamController = null;
    },
    close() {
      streamController?.close();
      streamController = null;
    },
  };

  return { stream, controller };
}
