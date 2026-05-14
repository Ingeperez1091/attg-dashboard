type RuntimeEnv = {
  NODE_ENV?: string;
  ENABLE_DEV_BYPASS?: string;
  DEV_SESSION_USER_ID?: string;
};

function toLogPayload(env: RuntimeEnv): Record<string, unknown> {
  return {
    nodeEnv: env.NODE_ENV ?? "unset",
    hasEnableDevBypass: typeof env.ENABLE_DEV_BYPASS === "string",
    enableDevBypassValue: env.ENABLE_DEV_BYPASS ?? "unset",
    hasDevSessionUserId:
      typeof env.DEV_SESSION_USER_ID === "string" &&
      env.DEV_SESSION_USER_ID.trim().length > 0,
  };
}

/**
 * Validates critical auth/runtime settings and emits a security audit event.
 * Throws on dangerous production configuration to fail fast.
 */
export function validateRuntimeSecurityConfig(
  env: RuntimeEnv = process.env,
): void {
  const isProduction = env.NODE_ENV === "production";
  const hasDevSessionUserId =
    typeof env.DEV_SESSION_USER_ID === "string" &&
    env.DEV_SESSION_USER_ID.trim().length > 0;
  const bypassExplicitlyEnabled = env.ENABLE_DEV_BYPASS === "true";
  const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

  console.log("[debug] ENV CHECK", {
    NODE_ENV: process.env.NODE_ENV,
    DEV_SESSION_USER_ID: process.env.DEV_SESSION_USER_ID,
    NEXT_PHASE: process.env.NEXT_PHASE,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_MICROSOFT_ENTRA_ID_ID: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    AUTH_MICROSOFT_ENTRA_ID_SECRET: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
  });

  // 🚫 Skip enforcement during build
  if (isBuildTime) {
    console.info(
      "[security] Skipping runtime security validation during build.",
      toLogPayload(env),
    );
    return;
  }

  if (isProduction && bypassExplicitlyEnabled) {
    console.error(
      "[security] Refusing startup: ENABLE_DEV_BYPASS must never be true in production.",
      toLogPayload(env),
    );
    throw new Error(
      "Invalid production security configuration: ENABLE_DEV_BYPASS=true",
    );
  }

  if (isProduction && hasDevSessionUserId) {
    console.error(
      "[security] Refusing startup: DEV_SESSION_USER_ID must not be set in production.",
      toLogPayload(env),
    );
    throw new Error(
      "Invalid production security configuration: DEV_SESSION_USER_ID is set",
    );
  }

  console.info("[security] Runtime security configuration validated.", {
    ...toLogPayload(env),
    bypassAllowedByEnvironment: !isProduction,
    timestamp: new Date().toISOString(),
  });
}
