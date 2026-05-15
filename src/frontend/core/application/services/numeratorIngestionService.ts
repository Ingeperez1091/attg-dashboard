import { RepositoryBundle } from "@/core/domain/repositories/RepositoryBundle";
import {
  SubmitNumeratorRequestDto,
  SubmitNumeratorResponseDto
} from "@/core/application/dto/numerator/NumeratorIngestionDto";
import { INumeratorIngestionRepository } from "@/core/domain/repositories/INumeratorIngestionRepository";
import { AppError } from "@/lib/api/error-handler";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";

const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export class NumeratorIngestionService {
  constructor(
    private readonly ingestionRepository: INumeratorIngestionRepository,
    private readonly repositories: RepositoryBundle
  ) {}

  async submit(
    request: SubmitNumeratorRequestDto,
    session: SessionEntity
  ): Promise<SubmitNumeratorResponseDto> {
    this.assertAuthorized(session, request.applicationId);
    await this.assertApplicationIsActive(request.applicationId);
    this.assertPayloadSafety(request.payload);

    const payloadJson = JSON.stringify(request.payload);
    const staged = await this.ingestionRepository.stagePayload({
      applicationId: request.applicationId,
      payloadJson,
      createdBy: session.userId
    });

    return {
      ingestionId: staged.stageId,
      applicationId: staged.applicationId,
      submittedAt: staged.createDate,
      status: "staged"
    };
  }

  private async assertApplicationIsActive(applicationId: string): Promise<void> {
    const activeApplications = await this.repositories.applications.listActive();
    const exists = activeApplications.some((application) => application.applicationId === applicationId);

    if (!exists) {
      throw new AppError(400, "INVALID_APPLICATION", "Invalid ApplicationId");
    }
  }

  private assertAuthorized(session: SessionEntity, applicationId: string): void {
    if (!session.isActive) {
      throw new AppError(403, "FORBIDDEN", "User is inactive.");
    }

    if (session.role === "administrator") {
      return;
    }

    if (session.role === "application_owner") {
      const hasAssignment = session.applications.includes("*") || session.applications.includes(applicationId);
      if (hasAssignment) {
        return;
      }

      throw new AppError(403, "FORBIDDEN", "Insufficient application scope.");
    }

    throw new AppError(403, "FORBIDDEN", "Insufficient role for numerator ingestion.");
  }

  private assertPayloadSafety(payload: Record<string, unknown> | unknown[]): void {
    const stack: unknown[] = [payload];

    while (stack.length > 0) {
      const current = stack.pop();

      if (!current || typeof current !== "object") {
        continue;
      }

      if (Array.isArray(current)) {
        for (const child of current) {
          stack.push(child);
        }
        continue;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new AppError(400, "VALIDATION_ERROR", "Payload contains unsafe object prototypes.");
      }

      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        if (UNSAFE_OBJECT_KEYS.has(key)) {
          throw new AppError(400, "VALIDATION_ERROR", "Payload contains unsafe keys.");
        }

        stack.push(value);
      }
    }
  }
}
