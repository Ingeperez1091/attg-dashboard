import { toStatusCode } from "@/lib/api/error-handler";
import {
  getRuntimeDenominatorPreviewRepository,
  getRuntimeMetricsRepository,
  getRuntimeRepositories,
  getRuntimeValidationPipelineRepository,
  getRuntimeADFPipelineClient
} from "@/infrastructure/persistence/runtime/repositories";
import { requireFilterWriteScope } from "@/infrastructure/middleware/filterAuthorizationMiddleware";
import { previewRequestSchema } from "@/infrastructure/validation/previewRequestSchema";
import { DenominatorPreviewService } from "@/core/application/services/denominatorPreviewService";
import { createSSEStream, SSE_HEADERS } from "@/lib/sse/sseStreamHelper";
import {
  createOperationContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logOperationValidationFailure
} from "@/lib/api/operation-logger";

function toContractError(error: unknown): { error: string; message: string } {
  const status = toStatusCode(error);
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";

  if (status === 401) return { error: "Unauthorized", message };
  if (status === 403) return { error: "Forbidden", message };
  if (status === 404) return { error: "NotFound", message };
  return {
    error: "InternalServerError",
    message: status >= 500 ? "An unexpected error occurred. Please contact support." : message
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ appId: string }> }
): Promise<Response> {
  const repositories = getRuntimeRepositories();
  const opCtx = createOperationContext(request);
  logOperationStart(opCtx);
  const start = Date.now();

  try {
    const { appId } = await context.params;

    // Auth check BEFORE SSE stream — errors returned as standard JSON
    const session = await requireFilterWriteScope(request, appId, repositories);
    opCtx.callerUserId = session.userId;

    // Validate request body BEFORE SSE stream — errors returned as standard JSON
    const body = await request.json();
    const parsed = previewRequestSchema.safeParse(body);

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

    // Create SSE stream and begin async pipeline execution
    const { stream, controller } = createSSEStream();

    const previewService = new DenominatorPreviewService(
      getRuntimeDenominatorPreviewRepository(),
      getRuntimeValidationPipelineRepository(),
      getRuntimeMetricsRepository(),
      getRuntimeADFPipelineClient()
    );

    // Execute preview in a microtask so the stream is returned immediately
    void (async () => {
      try {
        await previewService.executePreview(
          appId,
          session.userId,
          parsed.data.rules,
          controller
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Preview calculation failed.";
        controller.sendError({ message, previewRunId: "" });
      }
    })();

    logOperationSuccess(opCtx, 200, Date.now() - start);
    return new Response(stream, {
      status: 200,
      headers: SSE_HEADERS
    });
  } catch (error: unknown) {
    const status = toStatusCode(error);
    logOperationError(opCtx, error, status, Date.now() - start);
    return Response.json(toContractError(error), { status });
  }
}
