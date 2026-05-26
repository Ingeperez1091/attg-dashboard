/**
 * Structured operation logger for API route diagnostics.
 * Emits JSON log lines for request lifecycle, validation failures, and unhandled exceptions.
 */

interface OperationContext {
  method: string;
  path: string;
  callerUserId?: string;
  requestId?: string;
}

interface ValidationFailurePayload {
  field?: string;
  message: string;
  receivedValue?: string;
}

function getRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function safeSerialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 5).join("\n") };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(safeSerialize);
  if (typeof value === "object") {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (["password", "token", "secret", "authorization"].includes(k.toLowerCase())) continue;
      safe[k] = safeSerialize(v);
    }
    return safe;
  }
  return String(value);
}

export function createOperationContext(request: Request, callerUserId?: string): OperationContext {
  const url = new URL(request.url);
  return {
    method: request.method,
    path: url.pathname,
    callerUserId: callerUserId ?? "anonymous",
    requestId: getRequestId()
  };
}

export function logOperationStart(ctx: OperationContext): void {
  console.info(`[api-op] ${JSON.stringify({
    phase: "start",
    method: ctx.method,
    path: ctx.path,
    callerUserId: ctx.callerUserId,
    requestId: ctx.requestId,
    timestamp: getTimestamp()
  })}`);
}

export function logOperationSuccess(ctx: OperationContext, status: number, latencyMs: number): void {
  console.info(`[api-op] ${JSON.stringify({
    phase: "success",
    method: ctx.method,
    path: ctx.path,
    callerUserId: ctx.callerUserId,
    requestId: ctx.requestId,
    status,
    latencyMs,
    timestamp: getTimestamp()
  })}`);
}

export function logOperationValidationFailure(ctx: OperationContext, failures: ValidationFailurePayload[]): void {
  console.warn(`[api-op] ${JSON.stringify({
    phase: "validation-failure",
    method: ctx.method,
    path: ctx.path,
    callerUserId: ctx.callerUserId,
    requestId: ctx.requestId,
    failures,
    timestamp: getTimestamp()
  })}`);
}

export function logOperationError(ctx: OperationContext, error: unknown, status: number, latencyMs: number): void {
  console.error(`[api-op] ${JSON.stringify({
    phase: "error",
    method: ctx.method,
    path: ctx.path,
    callerUserId: ctx.callerUserId,
    requestId: ctx.requestId,
    status,
    latencyMs,
    error: safeSerialize(error),
    timestamp: getTimestamp()
  })}`);
}

export function logOperationAuthFailure(ctx: OperationContext, reason: string): void {
  console.warn(`[api-op] ${JSON.stringify({
    phase: "auth-failure",
    method: ctx.method,
    path: ctx.path,
    callerUserId: ctx.callerUserId,
    requestId: ctx.requestId,
    reason,
    timestamp: getTimestamp()
  })}`);
}
