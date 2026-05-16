import { AsyncLocalStorage } from "node:async_hooks";

type TraceContext = {
  requestId?: string;
};

const traceStorage = new AsyncLocalStorage<TraceContext>();

export function isAppBootTraceEnabled(): boolean {
  return process.env.APP_BOOT_TRACE === "true";
}

function getTracePrefix(): string {
  const traceContext = traceStorage.getStore();
  return traceContext?.requestId ? `[app-trace requestId=${traceContext.requestId}]` : "[app-trace]";
}

export function runWithTraceContext<T>(traceContext: TraceContext, callback: () => T): T {
  return traceStorage.run(traceContext, callback);
}

export function getCurrentTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

export function appBootTrace(message: string, context?: Record<string, unknown>): void {
  if (!isAppBootTraceEnabled()) {
    return;
  }

  const prefix = getTracePrefix();
  if (context) {
    console.info(`${prefix} ${message}`, context);
    return;
  }

  console.info(`${prefix} ${message}`);
}

export function createRepositoryTraceProxy<T extends object>(repository: T, repositoryName: string): T {
  if (!isAppBootTraceEnabled()) {
    return repository;
  }

  return new Proxy(repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") {
        return value;
      }

      return function tracedRepositoryMethod(this: unknown, ...args: unknown[]) {
        const methodName = String(property);
        const startedAt = Date.now();
        appBootTrace("repository:method:start", {
          repository: repositoryName,
          method: methodName
        });

        try {
          const result = Reflect.apply(value as (...methodArgs: unknown[]) => unknown, target, args);
          if (result && typeof (result as Promise<unknown>).then === "function") {
            return (result as Promise<unknown>).then((resolved) => {
              appBootTrace("repository:method:success", {
                repository: repositoryName,
                method: methodName,
                elapsedMs: Date.now() - startedAt
              });
              return resolved;
            }).catch((error: unknown) => {
              appBootTrace("repository:method:error", {
                repository: repositoryName,
                method: methodName,
                elapsedMs: Date.now() - startedAt,
                message: error instanceof Error ? error.message : String(error)
              });
              throw error;
            });
          }

          appBootTrace("repository:method:success", {
            repository: repositoryName,
            method: methodName,
            elapsedMs: Date.now() - startedAt
          });
          return result;
        } catch (error) {
          appBootTrace("repository:method:error", {
            repository: repositoryName,
            method: methodName,
            elapsedMs: Date.now() - startedAt,
            message: error instanceof Error ? error.message : String(error)
          });
          throw error;
        }
      };
    }
  });
}