/**
 * Next.js instrumentation hook — runs once when the server starts.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Bootstraps Application Insights so telemetry is active before the first request.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initAppInsights } = await import("@/lib/telemetry/app-insights");
    initAppInsights();
  }
}
