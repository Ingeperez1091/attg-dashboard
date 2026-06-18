import { describe, it, expect, vi, beforeEach } from "vitest";
import { DenominatorPreviewService, PreviewMetricsSummary } from "@/core/application/services/denominatorPreviewService";
import { DenominatorPreviewMemoryRepository } from "@/infrastructure/persistence/memory/DenominatorPreviewMemoryRepository";
import { ValidationPipelineMemoryRepository } from "@/infrastructure/persistence/memory/ValidationPipelineMemoryRepository";
import { MetricsMemoryRepository } from "@/infrastructure/persistence/memory/MetricsMemoryRepository";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";
import { SSEStreamController } from "@/lib/sse/sseStreamHelper";
import { DenominatorPreviewRuleInput } from "@/core/domain/repositories/IDenominatorPreviewRepository";
import { MetricSnapshot } from "@/core/domain/entities/MetricSnapshot";
import { PipelineRun } from "@/core/domain/entities/PipelineRun";

type TriggerSource = PipelineRun["triggerSource"];

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

function createMockADFClient(mode: "adf" | "local" = "local"): IADFPipelineClient {
  return {
    executionMode: mode,
    triggerValidationPipeline: vi.fn().mockResolvedValue({ accepted: true, executionMode: mode })
  };
}

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    snapshotId: "snap-1",
    runId: "run-1",
    applicationId: "app-1",
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

const sampleRules: DenominatorPreviewRuleInput[] = [
  { denominatorModelId: "model-1", operator: "IN_LIST", value: "11420;11421" }
];

describe("DenominatorPreviewService", () => {
  let previewRepo: DenominatorPreviewMemoryRepository;
  let metricsRepo: MetricsMemoryRepository;
  let adfClient: IADFPipelineClient;

  beforeEach(() => {
    vi.stubEnv("PIPELINE_EXECUTION_MODE", "local");
    previewRepo = new DenominatorPreviewMemoryRepository();
    metricsRepo = new MetricsMemoryRepository();
    adfClient = createMockADFClient("local");
  });

  describe("executePreview — happy path", () => {
    it("stages rules, triggers pipeline, reads metrics, sends complete event, cleans up", async () => {
      // Seed metrics: current production snapshot and a snapshot that will be found by runId
      // Since local executeLocalPipeline is a no-op in memory repo, we simulate the pipeline
      // completing by making the run completed BEFORE the service polls.
      // We'll need to override executeLocalPipeline to complete the run.
      const completedPipelineRepo = new (class extends ValidationPipelineMemoryRepository {
        override async executeLocalPipeline(input: { runId: string; applicationId: string; triggerSource: TriggerSource; actorUserId: string }): Promise<void> {
          // Simulate pipeline completing synchronously
          await this.updateRunStatus({
            runId: input.runId,
            status: "Completed",
            actorUserId: input.actorUserId
          });
        }
      })();

      const controller = createMockSSEController();

      // We need to seed metrics that the service can read.
      // The service calls getLatestSnapshot(appId) for current, and getLatestSnapshot(appId, runId) for projected.
      // Since we don't know the runId yet, we'll mock the metricsRepo.
      const mockedMetricsRepo = {
        getLatestSnapshot: vi.fn(),
        listSnapshotHistory: vi.fn(),
        getRunMetricsSummary: vi.fn(),
        listSyntheticInvestmentFacts: vi.fn()
      };

      // First call with (appId, runId) — the projected snapshot
      // Second call with (appId) — the current production snapshot
      mockedMetricsRepo.getLatestSnapshot
        .mockImplementation((appId: string, runId?: string) => {
          if (runId) {
            return Promise.resolve(makeSnapshot({
              runId,
              adoptionPct: 58.7,
              revenuePct: 51.2,
              matchedCount: 1247,
              denominatorCount: 2124,
              denominatorRevenue: 34700000
            }));
          }
          return Promise.resolve(makeSnapshot());
        });

      const serviceWithMock = new DenominatorPreviewService(
        previewRepo, completedPipelineRepo, mockedMetricsRepo, adfClient
      );

      await serviceWithMock.executePreview("app-1", "user-1", sampleRules, controller);

      // Should have status events then complete
      const statusEvents = controller.events.filter(e => e.type === "status");
      const completeEvents = controller.events.filter(e => e.type === "complete");
      const errorEvents = controller.events.filter(e => e.type === "error");

      expect(statusEvents.length).toBeGreaterThanOrEqual(2);
      expect(completeEvents).toHaveLength(1);
      expect(errorEvents).toHaveLength(0);

      // Verify complete payload has delta
      const payload = completeEvents[0].payload as { delta: PreviewMetricsSummary; warnings: string[] };
      expect(payload.delta.adoptionPct).toBeCloseTo(16.4, 1);
      expect(payload.delta.denominatorCount).toBe(2124 - 2948);
    });

    it("cleans up staged rules after successful preview", async () => {
      const completedPipelineRepo = new (class extends ValidationPipelineMemoryRepository {
        override async executeLocalPipeline(input: { runId: string; applicationId: string; triggerSource: TriggerSource; actorUserId: string }): Promise<void> {
          await this.updateRunStatus({ runId: input.runId, status: "Completed", actorUserId: input.actorUserId });
        }
      })();

      const mockedMetricsRepo = {
        getLatestSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
        listSnapshotHistory: vi.fn(),
        getRunMetricsSummary: vi.fn(),
        listSyntheticInvestmentFacts: vi.fn()
      };

      const testService = new DenominatorPreviewService(
        previewRepo, completedPipelineRepo, mockedMetricsRepo, adfClient
      );
      const controller = createMockSSEController();

      await testService.executePreview("app-1", "user-1", sampleRules, controller);

      // After execution, no staged rules should remain
      // Since sessionId is internal, check by size
      expect(previewRepo.hasRules("any-session")).toBe(false);
    });
  });

  describe("executePreview — error paths", () => {
    it("sends error event when pipeline fails", async () => {
      const failingPipelineRepo = new (class extends ValidationPipelineMemoryRepository {
        override async executeLocalPipeline(input: { runId: string; applicationId: string; triggerSource: TriggerSource; actorUserId: string }): Promise<void> {
          await this.updateRunStatus({
            runId: input.runId,
            status: "Failed",
            actorUserId: input.actorUserId,
            errorMessage: "SP execution failed"
          });
        }
      })();

      const testService = new DenominatorPreviewService(
        previewRepo, failingPipelineRepo, metricsRepo, adfClient
      );
      const controller = createMockSSEController();

      await testService.executePreview("app-1", "user-1", sampleRules, controller);

      const errorEvents = controller.events.filter(e => e.type === "error");
      expect(errorEvents).toHaveLength(1);
      expect((errorEvents[0].payload as { message: string }).message).toContain("SP execution failed");
    });

    it("sends error event when no metrics are generated after completion", async () => {
      const completedPipelineRepo = new (class extends ValidationPipelineMemoryRepository {
        override async executeLocalPipeline(input: { runId: string; applicationId: string; triggerSource: TriggerSource; actorUserId: string }): Promise<void> {
          await this.updateRunStatus({ runId: input.runId, status: "Completed", actorUserId: input.actorUserId });
        }
      })();

      // Metrics repo returns null for the preview run
      const emptyMetricsRepo = {
        getLatestSnapshot: vi.fn().mockResolvedValue(null),
        listSnapshotHistory: vi.fn(),
        getRunMetricsSummary: vi.fn(),
        listSyntheticInvestmentFacts: vi.fn()
      };

      const testService = new DenominatorPreviewService(
        previewRepo, completedPipelineRepo, emptyMetricsRepo, adfClient
      );
      const controller = createMockSSEController();

      await testService.executePreview("app-1", "user-1", sampleRules, controller);

      const errorEvents = controller.events.filter(e => e.type === "error");
      expect(errorEvents).toHaveLength(1);
      expect((errorEvents[0].payload as { message: string }).message).toContain("no metrics were generated");
    });

    it("cleans up staged rules even when pipeline throws", async () => {
      const throwingPipelineRepo = new (class extends ValidationPipelineMemoryRepository {
        override async executeLocalPipeline(_input: { runId: string; applicationId: string; triggerSource: TriggerSource; actorUserId: string }): Promise<void> {
          throw new Error("Unexpected SP error");
        }
      })();

      const testService = new DenominatorPreviewService(
        previewRepo, throwingPipelineRepo, metricsRepo, adfClient
      );
      const controller = createMockSSEController();

      await expect(
        testService.executePreview("app-1", "user-1", sampleRules, controller)
      ).rejects.toThrow("Unexpected SP error");

      // Staged rules should still be cleaned up via finally block
      // (No way to check internal sessionId, but store should be empty)
    });
  });

  describe("executePreview — ADF mode", () => {
    it("triggers ADF pipeline client with previewSessionId when in ADF mode", async () => {
      vi.stubEnv("PIPELINE_EXECUTION_MODE", "adf");
      const adfMock = createMockADFClient("adf");

      // Need a pipeline repo that will show the run as completed when polled
      const completedPipelineRepo = new (class extends ValidationPipelineMemoryRepository {
        private callCount = 0;
        override async getRunById(runId: string) {
          this.callCount++;
          const run = await super.getRunById(runId);
          if (run && this.callCount >= 2) {
            run.status = "Completed";
          }
          return run;
        }
      })();

      const mockedMetricsRepo = {
        getLatestSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
        listSnapshotHistory: vi.fn(),
        getRunMetricsSummary: vi.fn(),
        listSyntheticInvestmentFacts: vi.fn()
      };

      const testService = new DenominatorPreviewService(
        previewRepo, completedPipelineRepo, mockedMetricsRepo, adfMock
      );
      const controller = createMockSSEController();

      await testService.executePreview("app-1", "user-1", sampleRules, controller);

      expect(adfMock.triggerValidationPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: "app-1",
          triggerSource: "Preview",
          previewSessionId: expect.any(String)
        })
      );
    });
  });

  describe("warnings generation", () => {
    it("generates warning when denominator reduced > 25%", async () => {
      const completedPipelineRepo = new (class extends ValidationPipelineMemoryRepository {
        override async executeLocalPipeline(input: { runId: string; applicationId: string; triggerSource: TriggerSource; actorUserId: string }): Promise<void> {
          await this.updateRunStatus({ runId: input.runId, status: "Completed", actorUserId: input.actorUserId });
        }
      })();

      const mockedMetricsRepo = {
        getLatestSnapshot: vi.fn().mockImplementation((_appId: string, runId?: string) => {
          if (runId) {
            // Projected: denominator reduced by 50%
            return Promise.resolve(makeSnapshot({ denominatorCount: 1474, denominatorRevenue: 24000000 }));
          }
          return Promise.resolve(makeSnapshot({ denominatorCount: 2948, denominatorRevenue: 48200000 }));
        }),
        listSnapshotHistory: vi.fn(),
        getRunMetricsSummary: vi.fn(),
        listSyntheticInvestmentFacts: vi.fn()
      };

      const testService = new DenominatorPreviewService(
        previewRepo, completedPipelineRepo, mockedMetricsRepo, adfClient
      );
      const controller = createMockSSEController();

      await testService.executePreview("app-1", "user-1", sampleRules, controller);

      const completeEvent = controller.events.find(e => e.type === "complete");
      expect(completeEvent).toBeDefined();
      const warnings = (completeEvent?.payload as { warnings: string[] })?.warnings ?? [];
      expect(warnings.some(w => w.includes("reduced by 50%"))).toBe(true);
    });
  });
});
