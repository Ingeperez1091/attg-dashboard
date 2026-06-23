import { AppError, toStatusCode } from "@/lib/api/error-handler";
import {
  getRuntimeRepositories,
  getRuntimeNumeratorFilterRepository,
  getRuntimeConfigVersionRepository
} from "@/infrastructure/persistence/runtime/repositories";
import { logMutationEvent } from "@/lib/api/request-logger";
import {
  createOperationContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logOperationValidationFailure
} from "@/lib/api/operation-logger";
import {
  requireFilterReadScope,
  requireFilterWriteScope
} from "@/infrastructure/middleware/filterAuthorizationMiddleware";
import { NumeratorFilterService } from "@/core/application/services/NumeratorFilterService";
import { ConfigVersionService } from "@/core/application/services/configVersionService";
import { updateNumeratorFiltersSchema } from "@/infrastructure/validation/filterRuleSchemas";
import { RoleName } from "@/core/domain/entities/Role";

function toContractError(error: unknown): { error: string; message: string } {
  const status = toStatusCode(error);
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";

  if (status === 401) return { error: "Unauthorized", message };
  if (status === 403) return { error: "Forbidden", message };
  if (status === 404) return { error: "NotFound", message };
  return { error: "InternalServerError", message: status >= 500 ? "An unexpected error occurred. Please contact support." : message };
}

function validateForceSave(
  role: RoleName,
  overrideReason: string | undefined
): Response | null {
  if (role !== "administrator") {
    return Response.json({
      error: "Forbidden",
      message: "Force-save is restricted to administrators."
    }, { status: 403 });
  }
  if (!overrideReason) {
    return Response.json({
      error: "VALIDATION_ERROR",
      message: "overrideReason is required when forceOverride is true.",
      details: { code: "MISSING_OVERRIDE_REASON" }
    }, { status: 400 });
  }
  return null;
}

async function enforceOptimisticConcurrency(
  configVersionService: ConfigVersionService,
  appId: string,
  configVersion: number,
  userId: string
): Promise<Response | null> {
  const versionResult = await configVersionService.checkAndIncrement(
    appId,
    "Numerator",
    configVersion,
    userId
  );

  if (versionResult.success) return null;

  if (versionResult.conflict) {
    return Response.json({
      error: "VERSION_CONFLICT",
      message: "Configuration was modified by another user since you loaded it.",
      details: {
        currentVersion: versionResult.conflict.currentVersion,
        currentRules: versionResult.conflict.currentRules,
        lastModifiedBy: versionResult.conflict.lastModifiedBy,
        lastModifiedAt: versionResult.conflict.lastModifiedAt,
      }
    }, { status: 409 });
  }

  return Response.json({
    error: "NotFound",
    message: "Application configuration not found."
  }, { status: 404 });
}

function toAppErrorResponse(error: unknown): Response {
  if (error instanceof AppError && error.code === "FIELD_NOT_FILTERABLE") {
    return Response.json({
      error: "VALIDATION_ERROR",
      message: error.message,
      details: { code: "FIELD_NOT_FILTERABLE" }
    }, { status: 400 });
  }

  if (error instanceof AppError && error.status === 400) {
    return Response.json({
      error: "VALIDATION_ERROR",
      message: error.message,
      details: { code: error.code }
    }, { status: 400 });
  }

  return Response.json(toContractError(error), { status: toStatusCode(error) });
}

function requireConfigVersion(configVersion: number | undefined | null): Response | null {
  if (configVersion === undefined || configVersion === null) {
    return Response.json({
      error: "VALIDATION_ERROR",
      message: "configVersion is required.",
      details: { code: "MISSING_CONFIG_VERSION" }
    }, { status: 400 });
  }
  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ appId: string }> }
): Promise<Response> {
  const repositories = getRuntimeRepositories();
  const opCtx = createOperationContext(request);
  logOperationStart(opCtx);
  const start = Date.now();

  try {
    const { appId } = await context.params;
    const session = await requireFilterReadScope(request, appId, repositories);

    const service = new NumeratorFilterService(getRuntimeNumeratorFilterRepository());
    const ruleset = await service.getFiltersByApplicationId(appId);

    // Augment response with configVersion and activeEditors
    const configVersionService = new ConfigVersionService(getRuntimeConfigVersionRepository());
    const version = await configVersionService.getVersion(appId, "Numerator");

    const { getRuntimeConfigEditSessionRepository } = await import("@/infrastructure/persistence/runtime/repositories");
    const editSessionRepo = getRuntimeConfigEditSessionRepository();
    const activeEditors = await editSessionRepo.getActiveEditors(appId, "Numerator", session.userId);

    logOperationSuccess(opCtx, 200, Date.now() - start);
    return Response.json({
      ...ruleset,
      configVersion: version?.version ?? null,
      activeEditors,
    }, { status: 200 });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    return Response.json(toContractError(error), { status });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ appId: string }> }
): Promise<Response> {
  const repositories = getRuntimeRepositories();
  const opCtx = createOperationContext(request);
  logOperationStart(opCtx);
  const start = Date.now();

  try {
    const { appId } = await context.params;
    const session = await requireFilterWriteScope(request, appId, repositories);
    opCtx.callerUserId = session.userId;

    const body = await request.json();
    const parsed = updateNumeratorFiltersSchema.safeParse(body);
    
    if (!parsed.success) {
      const failures = parsed.error.errors.map((e) => ({
        field: e.path.join(".") || "request",
        message: e.message
      }));
      logOperationValidationFailure(opCtx, failures);
      return Response.json({
        error: "VALIDATION_ERROR",
        message: "Invalid request body.",
        details: {
          code: "INVALID_REQUEST_BODY"
        }
      }, { status: 400 });
    }

    // Require configVersion for optimistic concurrency control
    const versionError = requireConfigVersion(parsed.data.configVersion);
    if (versionError) return versionError;

    const configVersionService = new ConfigVersionService(getRuntimeConfigVersionRepository());

    // Force-save path (admin only)
    if (parsed.data.forceOverride) {
      const forceError = validateForceSave(session.role, parsed.data.overrideReason);
      if (forceError) return forceError;

      const forceResult = await configVersionService.forceIncrement(appId, "Numerator", session.userId);
      if (!forceResult) {
        return Response.json({
          error: "NotFound",
          message: "Application configuration not found."
        }, { status: 404 });
      }
    } else {
      // Standard OCC check
      const occError = await enforceOptimisticConcurrency(
        configVersionService,
        appId,
        parsed.data.configVersion!,
        session.userId
      );
      if (occError) return occError;
    }

    const service = new NumeratorFilterService(getRuntimeNumeratorFilterRepository());
    const auditOptions = parsed.data.forceOverride
      ? { changeType: "ForceOverride", overrideReason: parsed.data.overrideReason }
      : undefined;
    const updated = await service.updateFilters(appId, session.userId, parsed.data.rules, auditOptions);
    logMutationEvent("numerator.filters.update", session.userId, {
      applicationId: appId,
      ruleCount: parsed.data.rules.length
    });

    // Fetch new version to include in response
    const newVersion = await configVersionService.getVersion(appId, "Numerator");

    logOperationSuccess(opCtx, 200, Date.now() - start);
    return Response.json({ ...updated, configVersion: newVersion?.version ?? null }, { status: 200 });
  } catch (error: unknown) {
    logOperationError(opCtx, error, toStatusCode(error), Date.now() - start);
    return toAppErrorResponse(error);
  }
}
