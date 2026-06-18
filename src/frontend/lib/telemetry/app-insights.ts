/**
 * Application Insights integration for the ATTG Analytics Dashboard.
 *
 * Initialises the Node.js SDK when APPLICATIONINSIGHTS_CONNECTION_STRING is set.
 * Provides a `trackSecurityEvent()` bridge so structured security events emitted
 * by lib/api/security-audit.ts are also forwarded to Application Insights as
 * custom events — enabling KQL-based alerting, dashboards, and anomaly detection.
 *
 * Setup is idempotent: calling `initAppInsights()` multiple times is safe.
 *
 * Usage:
 *   import "@/lib/telemetry/app-insights";          // side-effect init
 *   import { trackSecurityEvent } from "@/lib/telemetry/app-insights";
 */

import type { SecurityEvent } from "@/lib/api/security-audit";

let clientReady = false;

// Lazy reference — only populated after successful init.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let defaultClient: any = null;

/**
 * Initialise Application Insights if a connection string is configured.
 * Must be called once at application startup (e.g. from instrumentation.ts).
 */
export function initAppInsights(): void {
  if (clientReady) return;

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    console.info("[telemetry] APPLICATIONINSIGHTS_CONNECTION_STRING not set — Application Insights disabled.");
    return;
  }

  try {
    // Dynamic import to keep the package optional at build time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const appInsights = require("applicationinsights");

    appInsights.setup(connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(false)      // We emit structured JSON; raw console capture is noise.
      .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
      .setSendLiveMetrics(false)
      .start();

    defaultClient = appInsights.defaultClient;
    defaultClient.context.tags[defaultClient.context.keys.cloudRole] = "attg-analytics-dashboard";
    clientReady = true;

    console.info("[telemetry] Application Insights initialised.");
  } catch (err) {
    console.warn("[telemetry] Failed to initialise Application Insights:", err);
  }
}

/**
 * Forward a structured security event to Application Insights as a custom event.
 * No-op if Application Insights is not initialised (missing connection string).
 */
export function trackSecurityEvent(event: SecurityEvent): void {
  if (!defaultClient) return;

  defaultClient.trackEvent({
    name: `Security.${event.event}`,
    properties: {
      severity: event.severity,
      reason: event.reason,
      ip: event.ip,
      path: event.path,
      method: event.method ?? "unknown",
      userId: event.userId ?? "anonymous",
      requestId: event.requestId ?? "none",
      userAgent: event.userAgent ?? "none",
      ...(event.metadata ? event.metadata : {}),
    },
  });
}

/**
 * Flush pending telemetry. Call during graceful shutdown.
 */
export async function flushAppInsights(): Promise<void> {
  if (!defaultClient) return;

  return new Promise<void>((resolve) => {
    defaultClient.flush({
      callback: () => resolve(),
    });
  });
}

// Register the forwarder globally so security-audit.ts can call it
// without a static require (which would pull applicationinsights into
// the Edge/middleware webpack bundle and break compilation).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__appInsightsTrackSecurity = trackSecurityEvent;

// Auto-init on import for convenience (server-side only).
initAppInsights();
