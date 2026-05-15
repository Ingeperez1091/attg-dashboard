import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import {
  IValidationPipelineRepository,
  ValidationResultsPage
} from "@/core/domain/repositories/IValidationPipelineRepository";
import { PipelineRun } from "@/core/domain/entities/PipelineRun";
import { ValidationRecordStatus } from "@/core/domain/entities/ValidationResult";
import { assertCanViewPipelineForApplication } from "@/lib/auth/pipelineAuthorization";

export interface ErrorBreakdownEntry {
  errorType: string;
  count: number;
}

export interface ValidationSummaryDto {
  applicationId: string;
  applicationName: string | null;
  runId: string | null;
  runDate: string | null;
  summary: {
    totalRecords: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    filteredOutCount: number;
    matchedCount: number;
  } | null;
  errorBreakdown: ErrorBreakdownEntry[];
}

/**
 * Normalise a per-record error message into a stable grouping key for the
 * error-breakdown summary.  ID-specific tokens are stripped so similar errors
 * collapse into the same bucket.
 */
function normalizeErrorType(message: string): string {
  if (message.includes("not found in denominator")) {
    return "ID not found in denominator";
  }

  if (message.startsWith("Failed filter rule(s):")) {
    return message;
  }

  return message;
}

export class ValidationPipelineService {
  constructor(private readonly repository: IValidationPipelineRepository) {}

  async getRunStatus(session: SessionEntity, runId: string): Promise<PipelineRun | null> {
    const run = await this.repository.getRunById(runId);
    if (!run) {
      return null;
    }

    assertCanViewPipelineForApplication(session, run.applicationId);
    return run;
  }

  async getValidationResults(
    session: SessionEntity,
    input: { applicationId: string; runId?: string; status?: ValidationRecordStatus; page: number; pageSize: number }
  ): Promise<ValidationResultsPage> {
    assertCanViewPipelineForApplication(session, input.applicationId);

    return this.repository.listValidationResults({
      applicationId: input.applicationId,
      runId: input.runId,
      status: input.status,
      page: input.page,
      pageSize: input.pageSize
    });
  }

  async getValidationSummary(
    session: SessionEntity,
    input: { applicationId: string; applicationName: string | null; runId?: string }
  ): Promise<ValidationSummaryDto> {
    assertCanViewPipelineForApplication(session, input.applicationId);

    // Resolve the target run: explicit runId or the latest run for the application.
    let run: PipelineRun | null = null;

    if (input.runId) {
      run = await this.repository.getRunById(input.runId);
    } else {
      const runs = await this.repository.listRunsByApplication(input.applicationId, 1);
      run = runs[0] ?? null;
    }

    if (!run) {
      return {
        applicationId: input.applicationId,
        applicationName: input.applicationName,
        runId: null,
        runDate: null,
        summary: null,
        errorBreakdown: []
      };
    }

    const summary = {
      totalRecords: run.totalRecordsIn ?? 0,
      validCount: run.validCount ?? 0,
      invalidCount: run.invalidCount ?? 0,
      duplicateCount: run.duplicateCount ?? 0,
      filteredOutCount: run.filteredOutCount ?? 0,
      matchedCount: run.matchedCount ?? 0
    };

    // Build error breakdown by grouping all non-valid result error messages.
    // Uses max 1000 records to bound memory; production-scale grouping is an aggregate query concern.
    const errorPage = await this.repository.listValidationResults({
      applicationId: input.applicationId,
      runId: run.runId,
      page: 1,
      pageSize: 1000
    });

    const countsByType = new Map<string, number>();

    for (const result of errorPage.items) {
      if (result.errorMessage) {
        const key = normalizeErrorType(result.errorMessage);
        countsByType.set(key, (countsByType.get(key) ?? 0) + 1);
      }
    }

    const errorBreakdown: ErrorBreakdownEntry[] = Array.from(countsByType.entries())
      .map(([errorType, count]) => ({ errorType, count }))
      .sort((a, b) => b.count - a.count);

    return {
      applicationId: input.applicationId,
      applicationName: input.applicationName,
      runId: run.runId,
      runDate: run.endTime ?? run.createDate,
      summary,
      errorBreakdown
    };
  }
}
