import { AppError } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { assertApplicationScope } from "@/lib/auth/authorization";
import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";
import { RoleName } from "@/core/domain/entities/Role";

export async function requireFilterReadScope(
  request: Request,
  applicationId: string,
  repositories: RepositoryBundle
): Promise<{ userId: string; role: RoleName }> {
  const session = await requireActive(request, repositories);
  assertApplicationScope(session, applicationId, "You do not have access to this application.");

  return { userId: session.userId, role: session.role };
}

export async function requireFilterWriteScope(
  request: Request,
  applicationId: string,
  repositories: RepositoryBundle
): Promise<{ userId: string; role: RoleName }> {
  const session = await requireFilterReadScope(request, applicationId, repositories);
  if (session.role !== "administrator" && session.role !== "application_owner") {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to edit rules for this application.");
  }

  return session;
}
