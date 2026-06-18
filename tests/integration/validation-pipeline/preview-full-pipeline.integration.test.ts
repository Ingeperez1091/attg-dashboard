import { describe, expect, it, beforeEach, vi } from "vitest";
import { DenominatorPreviewService } from "@/core/application/services/denominatorPreviewService";
import { DenominatorPreviewMemoryRepository } from "@/infrastructure/persistence/memory/DenominatorPreviewMemoryRepository";
import { ValidationPipelineMemoryRepository } from "@/infrastructure/persistence/memory/ValidationPipelineMemoryRepository";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";
import { IMetricsRepository } from "@/core/domain/repositories/metricsRepository";
import { MetricSnapshot } from "@/core/domain/entities/MetricSnapshot";
import { SSEStreamController } from "@/lib/sse/sseStreamHelper";
import { DenominatorPreviewRuleInput } from "@/core/domain/repositories/IDenominatorPreviewRepository";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function createMockSSEController(): SSEStreamController & {
  events: Array<{ type: string; payload: unknown }>;
} {
  const events: Array<{ type: string; payload: unknown }> = [];
  return {
    events,
    sendStatus(payload) { events.push({ type: "status", payload }); },
    sendComplete(payload) { events.push({ type: "complete", payload }); },
    sendError(payload) { events.push({ type: "error", payload }); },
    close() { events.push({ type: "close", payload: null }); }
  };
}

function makeSnapshot(runId: string, applicationId: string, overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    snapshotId: `snap-${runId}`,
    runId,
    applicationId,
    applicationName: "TestApp",
    calculationDate: "2026-06-14T12:00:00.000Z",
    denominatorCount: 2948,
    numeratorCount: 1500,
    matchedCount: 1247,
    adoptionPct: 42.3,
    denominatorRevenue: 48200000,
    numeratorRevenue: 25000000,
    revenuePct: 38.1,
    avgEngagement: null,
    metricDefinitionVersion: "1.0",
    refreshTimestamp: "2026-06-14T12:00:00.000Z",
    sourceBatchId: null,
    filterRuleSnapshotId: null,
    ...overrides
  };
}

/**
 * Integration test: full preview pipeline end-to-end using local SP execution mode.
 * Uses in-memory repositories with a custom pipeline executor that simulates
 * the SP completing synchronously (as it would with `executeLocalPipeline`).
 */
describe("integration - preview full pipeline (local SP execution)", () => {
  const appId = "10000000-0000-0000-0000-000000000001";
  const actorUserId = "30000000-0000-0000-0000-000000000001";
  const rules: DenominatorPreviewRuleInput[] = [
    { denominatorModelId: "50000000-0000-0000-0007-000000000000", operator: "IN_LIST", value: "11420;11421" },
    { denominatorModelId: "50000000-0000-0000-000C-000000000000", operator: "GREATER_THAN", value: "1000" }
  ];

  let previewRepo: DenominatorPreviewMemoryRepository;
  let pipelineRepo: ValidationPipelineMemoryRepository;
  let metricsRepo: IMetricsRepository;
  let adfClient: IADFPipelineClient;
  let service: DenominatorPreviewService;

  beforeEach(() => {
    vi.stubEnv("PIPELINE_EXECUTION_MODE", "local");

    previewRepo = new DenominatorPreviewMemoryRepository();

    // Pipeline repo that simulates SP completing synchronously
    pipelineRepo = new (class extends ValidationPipelineMemoryRepository {
      override async executeLocalPipeline(input: { runId: string; applicationId: string; triggerSource: "API" | "ADF" | "Manual" | "Preview"; actorUserId: string }): Promise<void> {
        await this.updateRunStatus({
          runId: input.runId,
          status: "Completed",
          actorUserId: input.actorUserId,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString()
        });
      }
    })();

    // Metrics repo that returns realistic snapshots
    metricsRepo = {
      getLatestSnapshot: vi.fn().mockImplementation((appIdArg: string, runId?: string) => {
        if (runId) {
          return Promise.resolve(makeSnapshot(runId, appIdArg, {
            adoptionPct: 58.7,
            revenuePct: 51.2,
            matchedCount: 1247,
            denominatorCount: 2124,
            denominatorRevenue: 34700000
          }));
        }
        return Promise.resolve(makeSnapshot("production-run", appIdArg));
      }),
      listSnapshotHistory: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 }),
      getRunMetricsSummary: vi.fn().mockResolvedValue(null),
      listSyntheticInvestmentFacts: vi.fn().mockResolvedValue([])
    };

    adfClient = {
      executionMode: "local",
      triggerValidationPipeline: vi.fn().mockResolvedValue({ accepted: true, executionMode: "local" })
    };

    service = new DenominatorPreviewService(previewRepo, pipelineRepo, metricsRepo, adfClient);
  });

  it("executes full preview lifecycle: stage → trigger → poll → metrics → cleanup", async () => {
    const controller = createMockSSEController();

    await service.executePreview(appId, actorUserId, rules, controller);

    // Verify SSE event sequence
    const statusEvents = controller.events.filter(e => e.type === "status");
    const completeEvents = controller.events.filter(e => e.type === "complete");
    const errorEvents = controller.events.filter(e => e.type === "error");

    expect(statusEvents.length).toBeGreaterThanOrEqual(2);
    expect(completeEvents).toHaveLength(1);
    expect(errorEvents).toHaveLength(0);
  });

  it("staged rules are cleaned up after successful preview", async () => {
    const controller = createMockSSEController();

    // Capture sessionId from the stageRules call
    const stageRulesSpy = vi.spyOn(previewRepo, "stageRules");
    const deleteBySessionIdSpy = vi.spyOn(previewRepo, "deleteBySessionId");

    await service.executePreview(appId, actorUserId, rules, controller);

    expect(stageRulesSpy).toHaveBeenCalledOnce();
    expect(deleteBySessionIdSpy).toHaveBeenCalledOnce();

    // Same sessionId used for both stage and delete
    const stagedSessionId = stageRulesSpy.mock.calls[0][0];
    expect(deleteBySessionIdSpy).toHaveBeenCalledWith(stagedSessionId);
  });

  it("complete event contains correct delta calculation", async () => {
    const controller = createMockSSEController();

    await service.executePreview(appId, actorUserId, rules, controller);

    const completeEvent = controller.events.find(e => e.type === "complete");
    expect(completeEvent).toBeDefined();

    const payload = completeEvent!.payload as {
      current: { adoptionPct: number; denominatorCount: number };
      projected: { adoptionPct: number; denominatorCount: number };
      delta: { adoptionPct: number; denominatorCount: number };
      warnings: string[];
      previewRunId: string;
      calculatedAtUtc: string;
    };

    expect(payload.current.adoptionPct).toBeCloseTo(42.3, 1);
    expect(payload.projected.adoptionPct).toBeCloseTo(58.7, 1);
    expect(payload.delta.adoptionPct).toBeCloseTo(16.4, 1);
    expect(payload.delta.denominatorCount).toBe(2124 - 2948);
    expect(payload.previewRunId).toMatch(/^[0-9a-f-]+$/);
    expect(payload.calculatedAtUtc).toBeTruthy();
  });

  it("generates >25% reduction warning when denominator significantly decreases", async () => {
    const controller = createMockSSEController();

    // Override metrics to show > 25% reduction
    (metricsRepo.getLatestSnapshot as ReturnType<typeof vi.fn>).mockImplementation(
      (_appId: string, runId?: string) => {
        if (runId) {
          return Promise.resolve(makeSnapshot(runId, _appId, {
            denominatorCount: 1000, // 66% reduction from 2948
            denominatorRevenue: 15000000
          }));
        }
        return Promise.resolve(makeSnapshot("production-run", _appId, {
          denominatorCount: 2948,
          denominatorRevenue: 48200000
        }));
      }
    );

    await service.executePreview(appId, actorUserId, rules, controller);

    const completeEvent = controller.events.find(e => e.type === "complete");
    const payload = completeEvent!.payload as { warnings: string[] };
    expect(payload.warnings.length).toBeGreaterThanOrEqual(1);
    expect(payload.warnings.some(w => w.includes("reduced by"))).toBe(true);
  });

  it("pipeline run is created with TriggerSource=Preview and previewSessionId", async () => {
    const controller = createMockSSEController();
    const createRunSpy = vi.spyOn(pipelineRepo, "createRun");

    await service.executePreview(appId, actorUserId, rules, controller);

    expect(createRunSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: appId,
        triggerSource: "Preview",
        actorUserId,
        previewSessionId: expect.any(String)
      })
    );
  });

  describe("SP migration verification", () => {
    it("usp_ExecutePipelineRun accepts @previewSessionId parameter", () => {
      const sp = readFileSync(
        resolve(process.cwd(), "database/stored-procedures/usp_ExecutePipelineRun.sql"),
        "utf8"
      );
      expect(sp).toContain("@previewSessionId");
      expect(sp).toContain("UNIQUEIDENTIFIER");
    });

    it("usp_BuildFilteredDenominator reads from stage.DenominatorFilterRulesPreview when sessionId provided", () => {
      const sp = readFileSync(
        resolve(process.cwd(), "database/stored-procedures/usp_BuildFilteredDenominator.sql"),
        "utf8"
      );
      expect(sp).toContain("@previewSessionId");
      expect(sp).toContain("stage.DenominatorFilterRulesPreview");
      expect(sp).toContain("SessionId = @previewSessionId");
    });
  });
});
