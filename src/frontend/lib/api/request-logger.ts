interface LogPayload {
  [key: string]: unknown;
}

const blockedKeys = new Set(["password", "token", "authorization", "sessionToken", "accessToken", "refreshToken"]);

function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)).filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const safe: LogPayload = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (blockedKeys.has(key)) {
        continue;
      }

      const sanitized = sanitizeValue(nestedValue);
      if (sanitized !== undefined) {
        safe[key] = sanitized;
      }
    }

    return safe;
  }

  return undefined;
}

export function logRequestStart(method: string, path: string, callerUserId: string): void {
  console.info(
    `[request] ${JSON.stringify({ method, path, callerUserId, timestamp: new Date().toISOString(), phase: "start" })}`
  );
}

export function logRequestEnd(
  method: string,
  path: string,
  callerUserId: string,
  status: number,
  latencyMs: number,
  errorMessage?: string
): void {
  console.info(
    `[request] ${JSON.stringify({
      method,
      path,
      callerUserId,
      status,
      latencyMs,
      errorMessage,
      timestamp: new Date().toISOString(),
      phase: "end"
    })}`
  );
}

export function logMutationEvent(action: string, actorUserId: string, details: unknown): void {
  const sanitizedDetails = sanitizeValue(details);
  console.info(
    `[mutation] ${JSON.stringify({
      action,
      actorUserId,
      details: sanitizedDetails,
      timestamp: new Date().toISOString()
    })}`
  );
}
