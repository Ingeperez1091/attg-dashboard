export interface ErrorBody {
  code: string;
  message: string;
  requestId: string;
}

export interface ContractErrorBody {
  error: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toErrorBody(error: unknown, requestId: string): ErrorBody {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      requestId
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
    requestId
  };
}

export function toStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.status;
  }

  return 500;
}

export function assertCondition(condition: boolean, status: number, code: string, message: string): void {
  if (!condition) {
    throw new AppError(status, code, message);
  }
}

export function toPublicContractError(error: unknown): ContractErrorBody {
  if (error instanceof AppError) {
    if (error.status === 401) {
      return { error: "UNAUTHORIZED", message: "No active session." };
    }

    if (error.status === 403) {
      return { error: "FORBIDDEN", message: "Insufficient permissions." };
    }

    return { error: error.code, message: error.message };
  }

  return { error: "INTERNAL_ERROR", message: "An unexpected error occurred." };
}
