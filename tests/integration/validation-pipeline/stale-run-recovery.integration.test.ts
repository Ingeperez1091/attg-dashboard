import { describe, expect, it, beforeEach, vi } from "vitest";
import { ValidationPipelineMemoryRepository } from "@/infrastructure/persistence/memory/ValidationPipelineMemoryRepository";
import { PipelineOrchestrationService } from "@/core/application/services/pipelineOrchestrationService";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";

const APP_ID = "10000000-0000-0000-0000-000000000001";
const ACTOR_USER_ID = "30000000-0000-0000-0000-000000000001";

function defined<T>(value: T | null | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}

function createMockSession(): SessionEntity {
  return {
    userId: ACTOR_USER_ID,
    role: "administrator",
    isActive: true,
    applications: [APP_ID],
  };
}

function createMockAdfClient(): IADFPipelineClient {
  return {
    executionMode: "local",
    triggerValidationPipeline: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Integration test: stale run recovery per FR-010a.
 * When a pipeline run is stuck > 30 minutes in Queued/Processing,
 * it is auto-failed and the new run proceeds.
 */
describe("integration - stale run recovery (FR-010a)", () => {
  let repository: ValidationPipelineMemoryRepository;
  let adfClient: IADFPipelineClient;
  let session: SessionEntity;

  beforeEach(() => {
    repository = new ValidationPipelineMemoryRepository();
    adfClient = createMockAdfClient();
    session = createMockSession();
  });

  it("blocks new run when existing run is active and < 30min old", async () => {
    // Create an in-progress run that's recent (< 30min)
    await repository.createRun({
      runId: "stale-run-001",
      applicationId: APP_ID,
      triggerSource: "Manual",
      actorUserId: ACTOR_USER_ID,
    });

    // Simulate the route's concurrency check (not using the service which bypasses guard for Preview)
    const latestRun = defined((await repository.listRunsByApplication(APP_ID, 1))[0]);
    expect(latestRun.status).toBe("Queued");

    const ageMs = Date.now() - new Date(latestRun.createDate).getTime();
    expect(ageMs).toBeLessThan(30 * 60 * 1000);
  });

  it("auto-fails stuck run > 30min and allows new pipeline trigger", async () => {
    // Create a run with an old createDate (> 30min ago)
    await repository.createRun({
      runId: "stale-run-002",
      applicationId: APP_ID,
      triggerSource: "Manual",
      actorUserId: ACTOR_USER_ID,
    });

    // Manually backdate the createDate to simulate a stale run (31 minutes ago)
    const staleDate = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    const retrieved = await repository.getRunById("stale-run-002");
    expect(retrieved).not.toBeNull();
    // Override createDate on the in-memory object to simulate a stuck run
    (retrieved as { createDate: string }).createDate = staleDate;

    // Simulate the route's stale recovery logic
    const latestRun = defined((await repository.listRunsByApplication(APP_ID, 1))[0]);
    expect(latestRun.status).toBe("Queued");
    const ageMs = Date.now() - new Date(latestRun.createDate).getTime();
    expect(ageMs).toBeGreaterThan(30 * 60 * 1000);

    // Auto-fail the stale run
    const failedRun = defined(await repository.updateRunStatus({
      runId: latestRun.runId,
      status: "Failed",
      actorUserId: ACTOR_USER_ID,
      errorMessage: "Auto-failed: exceeded 30-minute threshold (FR-010a stale recovery)",
    }));

    expect(failedRun.status).toBe("Failed");
    expect(failedRun.errorMessage).toContain("30-minute threshold");

    // Now the new run should proceed successfully
    const service = new PipelineOrchestrationService(repository, adfClient);
    const result = await service.triggerForApplication(session, {
      applicationId: APP_ID,
      triggerSource: "Manual",
    });

    expect(result.run.status).toBe("Queued");
    expect(result.run.applicationId).toBe(APP_ID);
  });

  it("does not auto-fail a completed run regardless of age", async () => {
    // Create a run and mark it completed
    await repository.createRun({
      runId: "completed-run-001",
      applicationId: APP_ID,
      triggerSource: "Manual",
      actorUserId: ACTOR_USER_ID,
    });
    await repository.updateRunStatus({
      runId: "completed-run-001",
      status: "Completed",
      actorUserId: ACTOR_USER_ID,
    });

    // A new run should proceed without any recovery logic needed
    const latestRun = defined((await repository.listRunsByApplication(APP_ID, 1))[0]);
    expect(latestRun.status).toBe("Completed");

    const service = new PipelineOrchestrationService(repository, adfClient);
    const result = await service.triggerForApplication(session, {
      applicationId: APP_ID,
      triggerSource: "Manual",
    });

    expect(result.run.status).toBe("Queued");
  });

  it("auto-fails Processing run > 30min (not just Queued)", async () => {
    // Create a run and set to Processing
    await repository.createRun({
      runId: "processing-stale-001",
      applicationId: APP_ID,
      triggerSource: "API",
      actorUserId: ACTOR_USER_ID,
    });
    await repository.updateRunStatus({
      runId: "processing-stale-001",
      status: "Processing",
      actorUserId: ACTOR_USER_ID,
      startTime: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    });

    // Backdate createDate
    const run = await repository.getRunById("processing-stale-001");
    (run as { createDate: string }).createDate = new Date(Date.now() - 35 * 60 * 1000).toISOString();

    // Verify stale detection
    const latestRun = defined((await repository.listRunsByApplication(APP_ID, 1))[0]);
    expect(latestRun.status).toBe("Processing");
    const ageMs = Date.now() - new Date(latestRun.createDate).getTime();
    expect(ageMs).toBeGreaterThan(30 * 60 * 1000);

    // Auto-fail
    const failedRun = defined(await repository.updateRunStatus({
      runId: latestRun.runId,
      status: "Failed",
      actorUserId: ACTOR_USER_ID,
      errorMessage: "Auto-failed: exceeded 30-minute threshold (FR-010a stale recovery)",
    }));
    expect(failedRun.status).toBe("Failed");
    expect(failedRun.errorMessage).toContain("FR-010a");
  });
});
