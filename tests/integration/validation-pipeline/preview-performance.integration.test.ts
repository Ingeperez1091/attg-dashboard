import { describe, expect, it, beforeEach, vi } from "vitest";
import { DenominatorPreviewService } from "@/core/application/services/denominatorPreviewService";
import { DenominatorPreviewMemoryRepository } from "@/infrastructure/persistence/memory/DenominatorPreviewMemoryRepository";
import { ValidationPipelineMemoryRepository } from "@/infrastructure/persistence/memory/ValidationPipelineMemoryRepository";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";
import { IMetricsRepository } from "@/core/domain/repositories/metricsRepository";
import { MetricSnapshot } from "@/core/domain/entities/MetricSnapshot";
import { SSEStreamController } from "@/lib/sse/sseStreamHelper";
import { DenominatorPreviewRuleInput } from "@/core/domain/repositories/IDenominatorPreviewRepository";

function createMockSSEController(): SSEStreamController & {
  events: Array<{ type: string; payload: unknown; timestamp: number }>;
} {
  const events: Array<{ type: string; payload: unknown; timestamp: number }> = [];
  return {
    events,
    sendStatus(payload) { events.push({ type: "status", payload, timestamp: Date.now() }); },
    sendComplete(payload) { events.push({ type: "complete", payload, timestamp: Date.now() }); },
    sendError(payload) { events.push({ type: "error", payload, timestamp: Date.now() }); },
    close() { events.push({ type: "close", payload: null, timestamp: Date.now() }); }
  };
}

function makeSnapshot(runId: string, applicationId: string, overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    snapshotId: `snap-${runId}`,
    runId,
    applicationId,
    applicationName: "PerfTestApp",
    calculationDate: "2026-06-14T12:00:00.000Z",
    denominatorCount: 48000,
    numeratorCount: 30000,
    matchedCount: 25000,
    adoptionPct: 52.1,
    denominatorRevenue: 120000000,
    numeratorRevenue: 75000000,
    revenuePct: 62.5,
    avgEngagement: null,
    metricDefinitionVersion: "1.0",
    refreshTimestamp: "2026-06-14T12:00:00.000Z",
    sourceBatchId: null,
    filterRuleSnapshotId: null,
    ...overrides
  };
}

/**
 * Performance validation test per SC-001/FR-007:
 * Preview pipeline must complete within 5 seconds for representative MVP data volume (< 50K rows).
 *
 * This test validates the end-to-end latency of the preview service orchestration
 * using in-memory repositories with simulated realistic delays.
 */
describe("integration - preview performance (SC-001/FR-007)", () => {
  const appId = "10000000-0000-0000-0000-000000000001";
  const actorUserId = "30000000-0000-0000-0000-000000000001";

  // Representative MVP rules — multiple filter conditions
  const rules: DenominatorPreviewRuleInput[] = [
    { denominatorModelId: "50000000-0000-0000-0007-000000000000", operator: "IN_LIST", value: "11420;11421;11422;11423;11424" },
    { denominatorModelId: "50000000-0000-0000-000C-000000000000", operator: "GREATER_THAN", value: "1000" },
    { denominatorModelId: "50000000-0000-0000-000D-000000000000", operator: "NOT_CONTAINS", value: "EXCLUDED" }
  ];

  let service: DenominatorPreviewService;

  beforeEach(() => {
    vi.stubEnv("PIPELINE_EXECUTION_MODE", "local");

    const previewRepo = new DenominatorPreviewMemoryRepository();

    // Simulate realistic SP execution delay (typical: 500ms–2s for < 50K rows)
    const pipelineRepo = new (class extends ValidationPipelineMemoryRepository {
      override async executeLocalPipeline(input: { runId: string; applicationId: string; triggerSource: "API" | "ADF" | "Manual" | "Preview"; actorUserId: string }): Promise<void> {
        // Simulate realistic pipeline execution time for MVP data volume
        await new Promise((resolve) => setTimeout(resolve, 800));
        await this.updateRunStatus({
          runId: input.runId,
          status: "Completed",
          actorUserId: input.actorUserId,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString()
        });
      }
    })();

    const metricsRepo: IMetricsRepository = {
      getLatestSnapshot: vi.fn().mockImplementation((appIdArg: string, runId?: string) => {
        if (runId) {
          return Promise.resolve(makeSnapshot(runId, appIdArg, {
            adoptionPct: 61.2,
            revenuePct: 55.8,
            matchedCount: 25000,
            denominatorCount: 40800,
            denominatorRevenue: 98000000
          }));
        }
        return Promise.resolve(makeSnapshot("production-run", appIdArg));
      }),
      listSnapshotHistory: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 }),
      getRunMetricsSummary: vi.fn().mockResolvedValue(null),
      listSyntheticInvestmentFacts: vi.fn().mockResolvedValue([])
    };

    const adfClient: IADFPipelineClient = {
      executionMode: "local",
      triggerValidationPipeline: vi.fn().mockResolvedValue({ accepted: true, executionMode: "local" })
    };

    service = new DenominatorPreviewService(previewRepo, pipelineRepo, metricsRepo, adfClient);
  });

  it("completes preview pipeline within 5s for MVP data volume (< 50K rows)", async () => {
    const controller = createMockSSEController();
    const startTime = Date.now();

    await service.executePreview(appId, actorUserId, rules, controller);

    const elapsedMs = Date.now() - startTime;

    // SC-001: Preview pipeline must complete within 5000ms for representative MVP data
    expect(elapsedMs).toBeLessThan(5000);

    // Verify successful completion (not just fast failure)
    const completeEvents = controller.events.filter(e => e.type === "complete");
    expect(completeEvents).toHaveLength(1);

    const errorEvents = controller.events.filter(e => e.type === "error");
    expect(errorEvents).toHaveLength(0);
  });

  it("SSE status events are emitted promptly (< 500ms from start)", async () => {
    const controller = createMockSSEController();
    const startTime = Date.now();

    await service.executePreview(appId, actorUserId, rules, controller);

    // First status event should arrive within 500ms of start (immediate progress feedback)
    const statusEvents = controller.events.filter(e => e.type === "status");
    expect(statusEvents.length).toBeGreaterThanOrEqual(1);
    expect(statusEvents[0].timestamp - startTime).toBeLessThan(500);
  });

  it("handles multiple concurrent preview requests without timeout", async () => {
    // Simulate 3 concurrent previews for different apps (MVP: 5 apps)
    const appIds = [
      "10000000-0000-0000-0000-000000000001",
      "10000000-0000-0000-0000-000000000002",
      "10000000-0000-0000-0000-000000000003"
    ];

    const startTime = Date.now();
    const controllers = appIds.map(() => createMockSSEController());

    await Promise.all(
      appIds.map((id, idx) =>
        service.executePreview(id, actorUserId, rules, controllers[idx])
      )
    );

    const elapsedMs = Date.now() - startTime;

    // All 3 should complete within 5s (concurrent, not sequential)
    expect(elapsedMs).toBeLessThan(5000);

    // All should succeed
    for (const controller of controllers) {
      const completeEvents = controller.events.filter(e => e.type === "complete");
      expect(completeEvents).toHaveLength(1);
    }
  });
});
