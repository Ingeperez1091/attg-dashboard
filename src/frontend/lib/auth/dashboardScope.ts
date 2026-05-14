import { DashboardScope } from "@/core/domain/entities/DashboardUsageView";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import { AppError } from "@/lib/api/error-handler";
import { assertActiveSession } from "@/lib/auth/authorization";

function logDashboardScopeDecision(event: {
  outcome: "granted" | "denied";
  userId: string;
  role: SessionEntity["role"];
  availableApplicationCount: number;
  scopedApplicationCount: number;
  selectedSubServiceLine: string | null;
  reason?: string;
}): void {
  console.info(
    `[dashboard-scope] ${JSON.stringify({
      ...event,
      timestamp: new Date().toISOString()
    })}`
  );
}

function normalizeApplicationIds(session: SessionEntity, availableApplicationIds: string[]): string[] {
  if (session.role === "administrator" || session.applications.includes("*")) {
    return [...availableApplicationIds];
  }

  const available = new Set(availableApplicationIds);
  return session.applications.filter((applicationId) => available.has(applicationId));
}

export function resolveDashboardScope(
  session: SessionEntity,
  input: {
    availableApplicationIds: string[];
    selectedSubServiceLine?: string | null;
  }
): DashboardScope {
  try {
    assertActiveSession(session);
  } catch {
    logDashboardScopeDecision({
      outcome: "denied",
      userId: session.userId,
      role: session.role,
      availableApplicationCount: input.availableApplicationIds.length,
      scopedApplicationCount: 0,
      selectedSubServiceLine: input.selectedSubServiceLine?.trim() || null,
      reason: "inactive_user"
    });
    throw new AppError(403, "FORBIDDEN", "User is inactive.");
  }

  const scopedApplicationIds = normalizeApplicationIds(session, input.availableApplicationIds);
  if (scopedApplicationIds.length === 0) {
    logDashboardScopeDecision({
      outcome: "denied",
      userId: session.userId,
      role: session.role,
      availableApplicationCount: input.availableApplicationIds.length,
      scopedApplicationCount: 0,
      selectedSubServiceLine: input.selectedSubServiceLine?.trim() || null,
      reason: "no_authorized_applications"
    });
    throw new AppError(403, "FORBIDDEN", "No authorized applications found for dashboard scope.");
  }

  const selectedSubServiceLine = input.selectedSubServiceLine?.trim() || null;

  logDashboardScopeDecision({
    outcome: "granted",
    userId: session.userId,
    role: session.role,
    availableApplicationCount: input.availableApplicationIds.length,
    scopedApplicationCount: scopedApplicationIds.length,
    selectedSubServiceLine
  });

  return {
    userId: session.userId,
    role: session.role,
    applicationIds: scopedApplicationIds,
    selectedSubServiceLine
  };
}

export function assertDashboardRunInScope(scope: DashboardScope, applicationId: string): void {
  if (!scope.applicationIds.includes(applicationId)) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions to access the requested run.");
  }
}
