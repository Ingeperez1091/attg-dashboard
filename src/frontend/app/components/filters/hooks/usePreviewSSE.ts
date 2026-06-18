"use client";

import { useCallback, useRef, useState } from "react";

export interface PreviewMetrics {
  adoptionPct: number;
  revenueSharePct: number;
  matchedCount: number;
  denominatorCount: number;
  denominatorRevenue: number;
}

export interface PreviewResult {
  current: PreviewMetrics;
  projected: PreviewMetrics;
  delta: PreviewMetrics;
  warnings: string[];
  previewRunId: string;
  calculatedAtUtc: string;
}

export interface PreviewProgress {
  stage: string;
  pctComplete: number;
}

export type PreviewState =
  | { status: "idle" }
  | { status: "streaming"; progress: PreviewProgress }
  | { status: "complete"; result: PreviewResult }
  | { status: "error"; message: string };

interface UsePreviewSSEOptions {
  appId: string;
  onComplete?: (result: PreviewResult) => void;
}

interface UsePreviewSSEReturn {
  state: PreviewState;
  startPreview: (rules: { denominatorModelId: string; operator: string; value: string }[]) => void;
  reset: () => void;
}

interface ParsedSSEEvent {
  type: string;
  data: string;
}

function parseSSEBlock(block: string): ParsedSSEEvent | null {
  if (!block.trim()) return null;

  const lines = block.split("\n");
  let eventType = "";
  let eventData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      eventData = line.slice(6);
    }
  }

  if (!eventType || !eventData) return null;
  return { type: eventType, data: eventData };
}

function handleSSEEvent(
  event: ParsedSSEEvent,
  setState: (state: PreviewState) => void,
  onComplete?: (result: PreviewResult) => void
): void {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(event.data);
  } catch {
    return;
  }

  if (event.type === "status") {
    setState({
      status: "streaming",
      progress: {
        stage: (parsed.stage as string) ?? "processing",
        pctComplete: (parsed.pctComplete as number) ?? 0,
      },
    });
  } else if (event.type === "complete") {
    const result = parsed as unknown as PreviewResult;
    setState({ status: "complete", result });
    onComplete?.(result);
  } else if (event.type === "error") {
    setState({
      status: "error",
      message: (parsed.message as string) ?? "Preview calculation failed.",
    });
  }
}

async function consumeSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  setState: (state: PreviewState) => void,
  onComplete?: (result: PreviewResult) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventBlock of events) {
      const event = parseSSEBlock(eventBlock);
      if (event) {
        handleSSEEvent(event, setState, onComplete);
      }
    }
  }
}

/**
 * Custom hook that consumes the SSE preview endpoint.
 * Manages streaming state, progress, completion, and errors.
 */
export function usePreviewSSE({ appId, onComplete }: UsePreviewSSEOptions): UsePreviewSSEReturn {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: "idle" });
  }, []);

  const startPreview = useCallback(
    (rules: { denominatorModelId: string; operator: string; value: string }[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ status: "streaming", progress: { stage: "queued", pctComplete: 0 } });

      (async () => {
        try {
          const token = typeof sessionStorage === "undefined"
            ? null
            : sessionStorage.getItem("attg_session_token");
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          const response = await fetch(`/api/filters/denominator/${appId}/preview`, {
            method: "POST",
            headers,
            body: JSON.stringify({ rules }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            setState({
              status: "error",
              message: (body as { message?: string }).message ?? "Preview request failed.",
            });
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            setState({ status: "error", message: "No response stream available." });
            return;
          }

          await consumeSSEStream(reader, setState, onComplete);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") return;
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Preview calculation failed.",
          });
        }
      })();
    },
    [appId, onComplete]
  );

  return { state, startPreview, reset };
}
