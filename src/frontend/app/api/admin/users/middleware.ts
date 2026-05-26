import { toErrorBody, toStatusCode } from "@/lib/api/error-handler";
import { logRequestEnd, logRequestStart } from "@/lib/api/request-logger";
import {
  createOperationContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logOperationAuthFailure
} from "@/lib/api/operation-logger";
import { requireAdministrator } from "@/lib/auth/guards";
import { logRepositoryMode } from "@/infrastructure/persistence/runtime/repositories";
import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";

export type ApiHandler = (request: Request, context: { sessionUserId: string }) => Promise<Response>;

type RepositoryResolver = RepositoryBundle | (() => RepositoryBundle);

function resolveRepositories(input: RepositoryResolver): RepositoryBundle {
  return typeof input === "function" ? input() : input;
}

/**
 * Wraps an API handler with administrator access enforcement and standardized error mapping.
 */
export function withAdminGuard(handler: ApiHandler, repositoriesInput: RepositoryResolver): (request: Request) => Promise<Response> {
  logRepositoryMode();

  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const repositories = resolveRepositories(repositoriesInput);
    const path = new URL(request.url).pathname;
    const method = request.method;
    const start = Date.now();
    let callerUserId = "anonymous";

    const opCtx = createOperationContext(request, callerUserId);
    logOperationStart(opCtx);
    logRequestStart(method, path, callerUserId);

    try {
      const session = await requireAdministrator(request, repositories);
      callerUserId = session.userId;
      opCtx.callerUserId = callerUserId;
      const response = await handler(request, { sessionUserId: session.userId });
      const latencyMs = Date.now() - start;
      logOperationSuccess(opCtx, response.status, latencyMs);
      logRequestEnd(method, path, callerUserId, response.status, latencyMs);
      return response;
    } catch (error: unknown) {
      const body = toErrorBody(error, requestId);
      const status = toStatusCode(error);
      const latencyMs = Date.now() - start;

      if (status === 401 || status === 403) {
        logOperationAuthFailure(opCtx, body.message);
      } else {
        logOperationError(opCtx, error, status, latencyMs);
      }

      logRequestEnd(method, path, callerUserId, status, latencyMs, body.message);

      return Response.json(body, { status });
    }
  };
}
