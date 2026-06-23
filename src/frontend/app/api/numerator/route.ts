import { AppError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { numeratorIngestionRequestSchema } from "@/lib/validation/numeratorIngestionSchema";
import { NumeratorIngestionService } from "@/core/application/services/numeratorIngestionService";
import { PipelineOrchestrationService } from "@/core/application/services/pipelineOrchestrationService";
import { getNumeratorIngestionDependencies, getRuntimeValidationPipelineRepository, getRuntimeADFPipelineClient } from "@/infrastructure/persistence/runtime/repositories";
import {
  createOperationContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logOperationValidationFailure
} from "@/lib/api/operation-logger";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/api/rate-limit";
import { logRateLimitEvent } from "@/lib/api/security-audit";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";

interface ContractErrorResponse {
  error: string;
  message: string;
  details?: Record<string, string>;
}

const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function toContractError(error: unknown, details?: Record<string, string>): ContractErrorResponse {
  if (error instanceof AppError) {
    return {
      error: error.code,
      message: error.status >= 500 ? "Failed to load data." : error.message,
      ...(details ? { details } : {})
    };
  }

  return {
    error: "INTERNAL_ERROR",
    message: "Failed to load data.",
    ...(details ? { details } : {})
  };
}

async function parseRequestBody(request: Request): Promise<unknown> {
  try {
    const rawBody = await request.text();
    return JSON.parse(rawBody, (key, value) => {
      if (UNSAFE_OBJECT_KEYS.has(key)) {
        throw new AppError(400, "VALIDATION_ERROR", "Payload contains unsafe keys.");
      }

      return value;
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(400, "VALIDATION_ERROR", "Malformed JSON request body.");
  }
}

/**
 * Auto-triggers the validation/metrics pipeline after a successful numerator upload.
 * Fire-and-forget: does not block the response and silently logs failures.
 * Skips if a pipeline run is already queued/processing for the application.
 */
async function triggerPipelineAfterIngestion(session: SessionEntity, applicationId: string): Promise<void> {
  try {
    const repository = getRuntimeValidationPipelineRepository();
    const latestRun = (await repository.listRunsByApplication(applicationId, 1))[0] ?? null;

    // Don't trigger if a run is already in progress
    if (latestRun && (latestRun.status === "Queued" || latestRun.status === "Processing")) {
      console.info(`[numerator:auto-trigger] Skipped — pipeline already in progress for ${applicationId}`);
      return;
    }

    const service = new PipelineOrchestrationService(repository, getRuntimeADFPipelineClient());
    const result = await service.triggerForApplication(session, {
      applicationId,
      triggerSource: "API"
    });

    console.info(`[numerator:auto-trigger] Pipeline triggered — runId=${result.run.runId}, mode=${result.executionMode}`);
  } catch (error: unknown) {
    // Non-fatal: log and continue. The ingestion was already successful.
    console.warn("[numerator:auto-trigger] Failed to trigger pipeline after ingestion:", error instanceof Error ? error.message : String(error));
  }
}

export async function POST(request: Request): Promise<Response> {
  // Rate limit: max 30 ingestion requests per minute per IP
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`numerator:${clientIp}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rateCheck.allowed) {
    logRateLimitEvent(request, "numerator-ingestion");
    return rateLimitedResponse(rateCheck);
  }

  const { repositories, ingestionRepository } = getNumeratorIngestionDependencies();
  const opCtx = createOperationContext(request);
  logOperationStart(opCtx);
  const start = Date.now();

  try {
    const session = await requireActive(request, repositories);
    opCtx.callerUserId = session.userId;
    const body = await parseRequestBody(request);
    const parsed = numeratorIngestionRequestSchema.safeParse(body);

    if (!parsed.success) {
      const details: Record<string, string> = {};
      const failures = parsed.error.issues.map((issue) => {
        const key = issue.path.join(".") || "request";
        if (!details[key]) {
          details[key] = issue.message;
        }
        return { field: key, message: issue.message };
      });

      logOperationValidationFailure(opCtx, failures);
      return Response.json(toContractError(new AppError(400, "VALIDATION_ERROR", "Invalid request body."), details), {
        status: 400
      });
    }

    const service = new NumeratorIngestionService(ingestionRepository, repositories);
    const result = await service.submit(parsed.data, session);

    logOperationSuccess(opCtx, 201, Date.now() - start);

    // Fire-and-forget: trigger pipeline processing after successful ingestion
    void triggerPipelineAfterIngestion(session, parsed.data.applicationId);

    return Response.json(result, { status: 201 });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    const body = toContractError(error);
    return Response.json(body, { status });
  }
}
