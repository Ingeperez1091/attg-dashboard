import { AppError, toStatusCode } from "@/lib/api/error-handler";
import {
  getRuntimeRepositories,
  getRuntimeConfigEditSessionRepository,
} from "@/infrastructure/persistence/runtime/repositories";
import { requireFilterReadScope, requireFilterWriteScope } from "@/infrastructure/middleware/filterAuthorizationMiddleware";
import { RuleScope } from "@/core/domain/entities/ConfigVersion";
import { SessionExistsError } from "@/infrastructure/persistence/memory/ConfigEditSessionMemoryRepository";

function toContractError(error: unknown): { error: string; message: string; details?: unknown } {
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  if (error instanceof AppError) {
    return { error: error.code, message: error.message };
  }
  return { error: "InternalServerError", message };
}

function parseScopeParam(scope: string): RuleScope {
  if (scope === "denominator") return "Denominator";
  if (scope === "numerator") return "Numerator";
  throw new AppError(400, "INVALID_SCOPE", `Invalid scope: ${scope}. Must be 'denominator' or 'numerator'.`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ scope: string; appId: string }> }
): Promise<Response> {
  try {
    const { scope, appId } = await context.params;
    const ruleScope = parseScopeParam(scope);
    const repositories = getRuntimeRepositories();

    // Require write scope (403 for viewers)
    const session = await requireFilterWriteScope(request, appId, repositories);

    const editSessionRepo = getRuntimeConfigEditSessionRepository();

    // Attempt to register
    try {
      const editSession = await editSessionRepo.register(
        appId,
        ruleScope,
        session.userId,
        null // displayName resolved by caller if needed
      );

      return Response.json(editSession, { status: 201 });
    } catch (regError: unknown) {
      if (regError instanceof SessionExistsError) {
        return Response.json(
          {
            error: "SESSION_EXISTS",
            message: "You already have an active edit session for this configuration.",
            details: { existingSessionId: regError.existingSessionId },
          },
          { status: 409 }
        );
      }
      throw regError;
    }
  } catch (error: unknown) {
    if (error instanceof AppError && error.status === 403) {
      return Response.json(
        { error: "Forbidden", message: "Viewers cannot register edit sessions." },
        { status: 403 }
      );
    }
    const status = toStatusCode(error);
    return Response.json(toContractError(error), { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ scope: string; appId: string }> }
): Promise<Response> {
  try {
    const { scope, appId } = await context.params;
    parseScopeParam(scope); // validate
    const repositories = getRuntimeRepositories();

    const session = await requireFilterReadScope(request, appId, repositories);

    const body = await request.json();
    const sessionId = body?.sessionId;
    if (!sessionId) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "sessionId is required." },
        { status: 400 }
      );
    }

    const editSessionRepo = getRuntimeConfigEditSessionRepository();
    const updated = await editSessionRepo.heartbeat(sessionId, session.userId);

    if (!updated) {
      return Response.json(
        { error: "NotFound", message: "Edit session not found or has expired." },
        { status: 404 }
      );
    }

    return Response.json(
      { sessionId: updated.sessionId, lastHeartbeat: updated.lastHeartbeat },
      { status: 200 }
    );
  } catch (error: unknown) {
    const status = toStatusCode(error);
    return Response.json(toContractError(error), { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ scope: string; appId: string }> }
): Promise<Response> {
  try {
    const { scope, appId } = await context.params;
    parseScopeParam(scope); // validate
    const repositories = getRuntimeRepositories();

    const session = await requireFilterReadScope(request, appId, repositories);

    const body = await request.json();
    const sessionId = body?.sessionId;
    if (!sessionId) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "sessionId is required." },
        { status: 400 }
      );
    }

    const editSessionRepo = getRuntimeConfigEditSessionRepository();
    const released = await editSessionRepo.release(sessionId, session.userId);

    if (!released) {
      return Response.json(
        { error: "NotFound", message: "Edit session not found." },
        { status: 404 }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    return Response.json(toContractError(error), { status });
  }
}
