/**
 * Centralized security event logger for the ATTG Analytics Dashboard.
 *
 * Emits structured JSON events to stdout/stderr for ingestion by Azure Monitor,
 * Application Insights, or any SIEM. Each event includes a consistent schema
 * to enable correlation, alerting, and anomaly detection.
 *
 * Event types:
 * - AUTH_FAILURE: Failed authentication attempt (invalid token, user not found)
 * - AUTH_SUCCESS: Successful authentication (useful for baseline analysis)
 * - RATE_LIMIT_HIT: Client exceeded rate limit threshold
 * - ACCESS_DENIED: Middleware rejected a request (no bearer, blocked route)
 * - PRIVILEGE_ESCALATION_ATTEMPT: User tried to access beyond their role
 * - CSRF_REJECTED: Request failed origin verification
 */

export type SecurityEventType =
  | "AUTH_FAILURE"
  | "AUTH_SUCCESS"
  | "RATE_LIMIT_HIT"
  | "ACCESS_DENIED"
  | "PRIVILEGE_ESCALATION_ATTEMPT"
  | "CSRF_REJECTED";

export type SecuritySeverity = "INFO" | "WARNING" | "CRITICAL";

export interface SecurityEvent {
  event: SecurityEventType;
  severity: SecuritySeverity;
  reason: string;
  userId?: string | null;
  ip: string;
  userAgent?: string;
  path: string;
  method?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Extracts the client IP from standard proxy headers.
 */
function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * Safely extracts the pathname from a request URL.
 */
function extractPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

/**
 * Emits a structured security event to the log stream and forwards
 * it to Application Insights (if configured).
 * WARNING and CRITICAL events go to stderr (console.warn).
 * INFO events go to stdout (console.info).
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const entry = {
    ...event,
    service: "attg-analytics-dashboard",
    timestamp: new Date().toISOString(),
  };

  const serialized = JSON.stringify(entry);

  if (event.severity === "INFO") {
    console.info(`[security] ${serialized}`);
  } else {
    console.warn(`[security] ${serialized}`);
  }

  // Forward to Application Insights for KQL alerting and dashboards.
  // Uses a global callback registered by app-insights.ts to avoid a static
  // require that would pull Node.js-only deps into the Edge/middleware bundle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forward = (globalThis as any).__appInsightsTrackSecurity;
  if (typeof forward === "function") forward(event);
}

/**
 * Convenience: log a failed authentication attempt from a Request object.
 */
export function logAuthFailureEvent(request: Request, reason: string, userId?: string): void {
  logSecurityEvent({
    event: "AUTH_FAILURE",
    severity: "WARNING",
    reason,
    userId: userId ?? null,
    ip: extractIp(request),
    userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? undefined,
    path: extractPath(request),
    method: request.method,
    requestId: request.headers.get("x-request-id") ?? undefined,
  });
}

/**
 * Convenience: log a rate-limit hit.
 */
export function logRateLimitEvent(request: Request, endpoint: string): void {
  logSecurityEvent({
    event: "RATE_LIMIT_HIT",
    severity: "WARNING",
    reason: `Rate limit exceeded for ${endpoint}`,
    ip: extractIp(request),
    userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? undefined,
    path: extractPath(request),
    method: request.method,
    requestId: request.headers.get("x-request-id") ?? undefined,
  });
}

/**
 * Convenience: log an access denial at the middleware layer.
 */
export function logAccessDeniedEvent(
  ip: string,
  path: string,
  reason: string,
  requestId?: string
): void {
  logSecurityEvent({
    event: "ACCESS_DENIED",
    severity: "WARNING",
    reason,
    ip,
    path,
    requestId,
  });
}

/**
 * Convenience: log a CSRF origin rejection.
 */
export function logCsrfRejectedEvent(request: Request, origin: string | null): void {
  logSecurityEvent({
    event: "CSRF_REJECTED",
    severity: "WARNING",
    reason: "Request origin did not match expected AUTH_URL",
    ip: extractIp(request),
    path: extractPath(request),
    method: request.method,
    metadata: { receivedOrigin: origin ?? "none" },
  });
}
