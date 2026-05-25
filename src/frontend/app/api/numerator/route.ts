import { AppError, toStatusCode } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { numeratorIngestionRequestSchema } from "@/lib/validation/numeratorIngestionSchema";
import { NumeratorIngestionService } from "@/core/application/services/numeratorIngestionService";
import { getNumeratorIngestionDependencies } from "@/infrastructure/persistence/runtime/repositories";
import {
  createOperationContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logOperationValidationFailure
} from "@/lib/api/operation-logger";

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

export async function POST(request: Request): Promise<Response> {
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
    return Response.json(result, { status: 201 });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    const body = toContractError(error);
    return Response.json(body, { status });
  }
}
