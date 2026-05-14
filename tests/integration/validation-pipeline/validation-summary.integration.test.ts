import { beforeEach, describe, expect, it } from "vitest";
import { ValidationPipelineService } from "@/core/application/services/validationPipelineService";
import { getRuntimeValidationPipelineRepository, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import { randomUUID } from "node:crypto";

const APP_ID = "10000000-0000-0000-0000-000000000001";
const RUN_ID = "70000000-0000-0000-0000-000000000090";
const ACTOR_ID = "30000000-0000-0000-0000-000000000001";

const adminSession: SessionEntity = {
  userId: ACTOR_ID,
  role: "administrator",
  isActive: true,
  applications: ["*"]
};

describe("validation pipeline integration - summary and error breakdown rendering", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = ACTOR_ID;
    resetRuntimeRepositoriesForTests();
  });

  it("returns null run data when no runs exist for the application", async () => {
    const repository = getRuntimeValidationPipelineRepository();
    const service = new ValidationPipelineService(repository);

    const summary = await service.getValidationSummary(adminSession, {
      applicationId: APP_ID,
      applicationName: "Maestro"
    });

    expect(summary.runId).toBeNull();
    expect(summary.runDate).toBeNull();
    expect(summary.summary).toBeNull();
    expect(summary.errorBreakdown).toHaveLength(0);
    expect(summary.applicationName).toBe("Maestro");
  });

  it("returns summary counts from the latest run for the application", async () => {
    const repository = getRuntimeValidationPipelineRepository();

    await repository.createRun({
      runId: RUN_ID,
      applicationId: APP_ID,
      triggerSource: "API",
      actorUserId: ACTOR_ID
    });

    await repository.updateRunCounts(RUN_ID, ACTOR_ID, {
      totalRecordsIn: 10,
      validCount: 5,
      invalidCount: 3,
      duplicateCount: 1,
      filteredOutCount: 1,
      matchedCount: 5
    });

    const service = new ValidationPipelineService(repository);
    const summary = await service.getValidationSummary(adminSession, {
      applicationId: APP_ID,
      applicationName: "Maestro"
    });

    expect(summary.runId).toBe(RUN_ID);
    expect(summary.summary).not.toBeNull();
    expect(summary.summary?.totalRecords).toBe(10);
    expect(summary.summary?.validCount).toBe(5);
    expect(summary.summary?.invalidCount).toBe(3);
    expect(summary.summary?.duplicateCount).toBe(1);
    expect(summary.summary?.filteredOutCount).toBe(1);
    expect(summary.summary?.matchedCount).toBe(5);
  });

  it("groups error messages by normalised errorType in the breakdown", async () => {
    const repository = getRuntimeValidationPipelineRepository();

    await repository.createRun({
      runId: RUN_ID,
      applicationId: APP_ID,
      triggerSource: "API",
      actorUserId: ACTOR_ID
    });

    await repository.upsertValidationResults([
      {
        resultId: randomUUID(),
        pipelineRunId: RUN_ID,
        applicationId: APP_ID,
        stageId: randomUUID(),
        recordKey: "ENG-001",
        status: "Invalid",
        errorMessage: "Engagement ID ENG-001 not found in denominator",
        actorUserId: ACTOR_ID
      },
      {
        resultId: randomUUID(),
        pipelineRunId: RUN_ID,
        applicationId: APP_ID,
        stageId: randomUUID(),
        recordKey: "ENG-002",
        status: "Invalid",
        errorMessage: "Engagement ID ENG-002 not found in denominator",
        actorUserId: ACTOR_ID
      },
      {
        resultId: randomUUID(),
        pipelineRunId: RUN_ID,
        applicationId: APP_ID,
        stageId: randomUUID(),
        recordKey: null,
        status: "Invalid",
        errorMessage: "Missing Engagement/Client ID",
        actorUserId: ACTOR_ID
      },
      {
        resultId: randomUUID(),
        pipelineRunId: RUN_ID,
        applicationId: APP_ID,
        stageId: randomUUID(),
        recordKey: "ENG-004",
        status: "Duplicate",
        errorMessage: "Duplicate match key in staged batch",
        actorUserId: ACTOR_ID
      },
      {
        resultId: randomUUID(),
        pipelineRunId: RUN_ID,
        applicationId: APP_ID,
        stageId: randomUUID(),
        recordKey: "ENG-005",
        status: "FilteredOut",
        errorMessage: "Failed filter rule(s): Budget GREATER_OR_EQUAL 20000",
        actorUserId: ACTOR_ID
      },
      // Valid record — no error message, should not appear in breakdown.
      {
        resultId: randomUUID(),
        pipelineRunId: RUN_ID,
        applicationId: APP_ID,
        stageId: randomUUID(),
        recordKey: "ENG-006",
        status: "Valid",
        errorMessage: null,
        actorUserId: ACTOR_ID
      }
    ]);

    const service = new ValidationPipelineService(repository);
    const summary = await service.getValidationSummary(adminSession, {
      applicationId: APP_ID,
      applicationName: null
    });

    const breakdown = summary.errorBreakdown;

    // Two "not found in denominator" messages collapse into one normalised group.
    const idNotFound = breakdown.find((e) => e.errorType === "ID not found in denominator");
    expect(idNotFound).toBeDefined();
    expect(idNotFound?.count).toBe(2);

    // "Missing..." stays as its own exact group.
    const missing = breakdown.find((e) => e.errorType === "Missing Engagement/Client ID");
    expect(missing).toBeDefined();
    expect(missing?.count).toBe(1);

    // Duplicate stays as its own exact group.
    const duplicate = breakdown.find((e) => e.errorType === "Duplicate match key in staged batch");
    expect(duplicate).toBeDefined();
    expect(duplicate?.count).toBe(1);

    // FilteredOut rule message is kept verbatim (not normalised further).
    const filtered = breakdown.find((e) => e.errorType === "Failed filter rule(s): Budget GREATER_OR_EQUAL 20000");
    expect(filtered).toBeDefined();
    expect(filtered?.count).toBe(1);

    // Valid record has no errorMessage — must NOT appear in breakdown.
    const total = breakdown.reduce((sum, e) => sum + e.count, 0);
    expect(total).toBe(5); // 5 non-valid records with error messages
  });

  it("breakdown is sorted by count descending — highest-frequency errors first", async () => {
    const repository = getRuntimeValidationPipelineRepository();

    await repository.createRun({
      runId: RUN_ID,
      applicationId: APP_ID,
      triggerSource: "API",
      actorUserId: ACTOR_ID
    });

    // Seed 3x "not found" and 1x "Missing" so breakdown should be ordered [3, 1].
    const results = [
      ...Array.from({ length: 3 }, () => ({
        resultId: randomUUID(),
        pipelineRunId: RUN_ID,
        applicationId: APP_ID,
        stageId: randomUUID(),
        recordKey: `ENG-${randomUUID().slice(0, 8)}`,
        status: "Invalid" as const,
        errorMessage: `Engagement ID ENG-X not found in denominator`,
        actorUserId: ACTOR_ID
      })),
      {
        resultId: randomUUID(),
        pipelineRunId: RUN_ID,
        applicationId: APP_ID,
        stageId: randomUUID(),
        recordKey: null,
        status: "Invalid" as const,
        errorMessage: "Missing Engagement/Client ID",
        actorUserId: ACTOR_ID
      }
    ];

    await repository.upsertValidationResults(results);

    const service = new ValidationPipelineService(repository);
    const summary = await service.getValidationSummary(adminSession, {
      applicationId: APP_ID,
      applicationName: null
    });

    expect(summary.errorBreakdown.length).toBeGreaterThan(0);
    // First entry should have the highest count.
    const [first, ...rest] = summary.errorBreakdown;
    for (const entry of rest) {
      expect(first.count).toBeGreaterThanOrEqual(entry.count);
    }
  });

  it("filters by specific runId when provided — ignores other runs", async () => {
    const repository = getRuntimeValidationPipelineRepository();
    const otherRunId = "70000000-0000-0000-0000-000000000091";

    await repository.createRun({
      runId: RUN_ID,
      applicationId: APP_ID,
      triggerSource: "API",
      actorUserId: ACTOR_ID
    });

    await repository.createRun({
      runId: otherRunId,
      applicationId: APP_ID,
      triggerSource: "API",
      actorUserId: ACTOR_ID
    });

    await repository.upsertValidationResults([{
      resultId: randomUUID(),
      pipelineRunId: RUN_ID,
      applicationId: APP_ID,
      stageId: randomUUID(),
      recordKey: "ENG-001",
      status: "Invalid",
      errorMessage: "Engagement ID ENG-001 not found in denominator",
      actorUserId: ACTOR_ID
    }]);

    const service = new ValidationPipelineService(repository);

    // Request the OTHER run — should have empty breakdown since we didn't seed results for it.
    const summary = await service.getValidationSummary(adminSession, {
      applicationId: APP_ID,
      applicationName: null,
      runId: otherRunId
    });

    expect(summary.runId).toBe(otherRunId);
    expect(summary.errorBreakdown).toHaveLength(0);
  });
});
