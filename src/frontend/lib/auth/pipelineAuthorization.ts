import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import { assertActiveSession, assertApplicationScope, assertOneOfRoles } from "@/lib/auth/authorization";

export function assertCanTriggerPipelineForApplication(session: SessionEntity, applicationId: string): void {
  assertActiveSession(session);

  if (session.role === "administrator") {
    return;
  }

  assertOneOfRoles(session, ["application_owner"], "Insufficient permissions to trigger pipeline run.");
  assertApplicationScope(session, applicationId, "Insufficient permissions to trigger pipeline run.");
}

export function assertCanViewPipelineForApplication(session: SessionEntity, applicationId: string): void {
  assertActiveSession(session);

  if (session.role === "administrator") {
    return;
  }

  assertOneOfRoles(session, ["application_owner"], "Insufficient permissions to view pipeline data.");
  assertApplicationScope(session, applicationId, "Insufficient permissions to view pipeline data.");
}
