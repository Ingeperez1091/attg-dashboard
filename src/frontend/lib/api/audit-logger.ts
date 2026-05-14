type AuditLevel = "info" | "warn";

interface UserCreationSuccessAudit {
  action: "create";
  userId: string;
  email: string;
  createdBy: string;
  timestamp: string;
}

interface UserCreationFailureAudit {
  action: "create_failed";
  reason: string;
  createdBy: string;
  timestamp: string;
  payload: {
    username?: string;
    email?: string;
    displayName?: string;
  };
}

interface SsoIdentityBindSuccessAudit {
  action: "sso_identity_bind";
  userId: string;
  email: string;
  azureAdObjectId: string;
  timestamp: string;
}

function writeAudit(level: AuditLevel, event: UserCreationSuccessAudit | UserCreationFailureAudit | SsoIdentityBindSuccessAudit): void {
  const serialized = JSON.stringify(event);

  if (level === "warn") {
    console.warn(`[audit] ${serialized}`);
    return;
  }

  console.info(`[audit] ${serialized}`);
}

export function logUserCreateSuccess(userId: string, email: string, createdBy: string): void {
  writeAudit("info", {
    action: "create",
    userId,
    email,
    createdBy,
    timestamp: new Date().toISOString()
  });
}

export function logUserCreateFailure(reason: string, createdBy: string, payload: unknown): void {
  const safePayload =
    payload && typeof payload === "object"
      ? {
          username: typeof (payload as Record<string, unknown>).username === "string"
            ? (payload as Record<string, string>).username
            : undefined,
          email: typeof (payload as Record<string, unknown>).email === "string"
            ? (payload as Record<string, string>).email
            : undefined,
          displayName: typeof (payload as Record<string, unknown>).displayName === "string"
            ? (payload as Record<string, string>).displayName
            : undefined
        }
      : {};

  writeAudit("warn", {
    action: "create_failed",
    reason,
    createdBy,
    timestamp: new Date().toISOString(),
    payload: safePayload
  });
}

export function logSsoIdentityBindSuccess(userId: string, email: string, azureAdObjectId: string): void {
  writeAudit("info", {
    action: "sso_identity_bind",
    userId,
    email,
    azureAdObjectId,
    timestamp: new Date().toISOString()
  });
}
