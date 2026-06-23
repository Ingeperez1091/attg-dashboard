import { randomUUID } from "node:crypto";
import { IDenominatorPreviewRepository, DenominatorPreviewRuleInput } from "@/core/domain/repositories/IDenominatorPreviewRepository";
import { IValidationPipelineRepository } from "@/core/domain/repositories/IValidationPipelineRepository";
import { IMetricsRepository } from "@/core/domain/repositories/metricsRepository";
import { PipelineRun, CreatePipelineRunInput } from "@/core/domain/entities/PipelineRun";
import { MetricSnapshot } from "@/core/domain/entities/MetricSnapshot";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";
import { SSEStreamController } from "@/lib/sse/sseStreamHelper";

type PipelineExecutionMode = "adf" | "local";

function resolveExecutionMode(adfClient: IADFPipelineClient): PipelineExecutionMode {
  const configuredMode = process.env.PIPELINE_EXECUTION_MODE?.trim().toLowerCase();
  if (configuredMode === "adf" || configuredMode === "local") {
    return configuredMode;
  }
  return adfClient.executionMode;
}

export interface PreviewMetricsSummary {
  adoptionPct: number;
  revenueSharePct: number;
  matchedCount: number;
  denominatorCount: number;
  denominatorRevenue: number;
}

export interface PreviewResult {
  current: PreviewMetricsSummary;
  projected: PreviewMetricsSummary;
  delta: PreviewMetricsSummary;
  warnings: string[];
  previewRunId: string;
  calculatedAtUtc: string;
}

const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 60; // 30 seconds max

export class DenominatorPreviewService {
  constructor(
    private readonly previewRepository: IDenominatorPreviewRepository,
    private readonly pipelineRepository: IValidationPipelineRepository,
    private readonly metricsRepository: IMetricsRepository,
    private readonly adfClient: IADFPipelineClient
  ) {}

  /**
   * Execute the full preview flow:
   * 1. Stage proposed rules
   * 2. Create pipeline run record
   * 3. Trigger pipeline execution (local or ADF)
   * 4. Poll for completion
   * 5. Read metrics and compute delta
   * 6. Cleanup staged rules
   *
   * Sends SSE events via the provided controller throughout.
   */
  async executePreview(
    applicationId: string,
    actorUserId: string,
    rules: DenominatorPreviewRuleInput[],
    sseController: SSEStreamController
  ): Promise<void> {
    const sessionId = randomUUID();
    const runId = randomUUID();

    try {
      // Step 1: Stage rules
      await this.previewRepository.stageRules(sessionId, applicationId, rules);

      // Step 2: Create pipeline run
      const runInput: CreatePipelineRunInput = {
        runId,
        applicationId,
        triggerSource: "Preview",
        actorUserId,
        previewSessionId: sessionId
      };
      await this.pipelineRepository.createRun(runInput);

      sseController.sendStatus({ stage: "queued", pctComplete: 0, previewRunId: runId });

      // Step 3: Trigger pipeline execution
      const executionMode = resolveExecutionMode(this.adfClient);

      if (executionMode === "adf") {
        await this.adfClient.triggerValidationPipeline({
          runId,
          applicationId,
          triggerSource: "Preview",
          actorUserId,
          previewSessionId: sessionId
        });
      } else {
        await this.pipelineRepository.executeLocalPipeline(runInput);
      }

      sseController.sendStatus({ stage: "processing", pctComplete: 25 });

      // Step 4: Poll for completion (or return immediately for local sync execution)
      const completedRun = await this.pollForCompletion(runId, sseController);

      if (completedRun.status === "Failed") {
        sseController.sendError({
          message: completedRun.errorMessage ?? "Preview calculation failed. Please try again.",
          previewRunId: runId
        });
        return;
      }

      // Step 5: Read metrics and compute delta
      sseController.sendStatus({ stage: "calculating_metrics", pctComplete: 90 });

      const result = await this.computeDelta(applicationId, runId);
      if (!result) {
        sseController.sendError({
          message: "Preview completed but no metrics were generated.",
          previewRunId: runId
        });
        return;
      }

      sseController.sendComplete({
        current: result.current,
        projected: result.projected,
        delta: result.delta,
        warnings: result.warnings,
        previewRunId: runId,
        calculatedAtUtc: new Date().toISOString()
      });
    } finally {
      // Step 6: Cleanup staged rules (always, even on error)
      await this.previewRepository.deleteBySessionId(sessionId).catch(() => {
        // Best-effort cleanup; TTL will handle orphans
      });
    }
  }

  private async pollForCompletion(
    runId: string,
    sseController: SSEStreamController
  ): Promise<PipelineRun> {
    let attempts = 0;

    while (attempts < MAX_POLL_ATTEMPTS) {
      const run = await this.pipelineRepository.getRunById(runId);

      if (!run) {
        throw new Error(`Pipeline run ${runId} not found during polling.`);
      }

      if (run.status === "Completed" || run.status === "Failed") {
        return run;
      }

      if (run.status === "Processing" && attempts % 4 === 0 && attempts > 0) {
        sseController.sendStatus({ stage: "filtering_denominator", pctComplete: 50 });
      }

      if (run.status === "Processing" && attempts % 8 === 0 && attempts > 4) {
        sseController.sendStatus({ stage: "matching_numerator", pctComplete: 75 });
      }

      attempts++;
      await delay(POLL_INTERVAL_MS);
    }

    throw new Error(`Preview pipeline timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms.`);
  }

  private async computeDelta(
    applicationId: string,
    previewRunId: string
  ): Promise<PreviewResult | null> {
    // Get the preview run's metrics snapshot
    const projectedSnapshot = await this.metricsRepository.getLatestSnapshot(applicationId, previewRunId);
    if (!projectedSnapshot) {
      return null;
    }

    // Get the latest non-preview (production) metrics snapshot
    const currentSnapshot = await this.metricsRepository.getLatestSnapshot(applicationId);

    const current = this.toMetricsSummary(currentSnapshot);
    const projected = this.toMetricsSummary(projectedSnapshot);
    const delta = this.computeMetricsDelta(current, projected);
    const warnings = this.generateWarnings(current, projected, delta);

    return {
      current,
      projected,
      delta,
      warnings,
      previewRunId,
      calculatedAtUtc: new Date().toISOString()
    };
  }

  private toMetricsSummary(snapshot: MetricSnapshot | null): PreviewMetricsSummary {
    if (!snapshot) {
      return {
        adoptionPct: 0,
        revenueSharePct: 0,
        matchedCount: 0,
        denominatorCount: 0,
        denominatorRevenue: 0
      };
    }

    return {
      adoptionPct: snapshot.adoptionPct,
      revenueSharePct: snapshot.revenuePct,
      matchedCount: snapshot.matchedCount,
      denominatorCount: snapshot.denominatorCount,
      denominatorRevenue: snapshot.denominatorRevenue ?? 0
    };
  }

  private computeMetricsDelta(
    current: PreviewMetricsSummary,
    projected: PreviewMetricsSummary
  ): PreviewMetricsSummary {
    return {
      adoptionPct: round(projected.adoptionPct - current.adoptionPct, 1),
      revenueSharePct: round(projected.revenueSharePct - current.revenueSharePct, 1),
      matchedCount: projected.matchedCount - current.matchedCount,
      denominatorCount: projected.denominatorCount - current.denominatorCount,
      denominatorRevenue: round(projected.denominatorRevenue - current.denominatorRevenue, 2)
    };
  }

  private generateWarnings(
    current: PreviewMetricsSummary,
    _projected: PreviewMetricsSummary,
    delta: PreviewMetricsSummary
  ): string[] {
    const warnings: string[] = [];

    // Warning if denominator count is reduced by > 25%
    if (current.denominatorCount > 0 && delta.denominatorCount < 0) {
      const reductionPct = Math.abs(delta.denominatorCount) / current.denominatorCount * 100;
      if (reductionPct > 25) {
        warnings.push(
          `Denominator reduced by ${Math.round(reductionPct)}% — adoption % increases due to smaller base`
        );
      }
    }

    // Warning if denominator becomes zero (empty result)
    if (current.denominatorCount > 0 && current.denominatorCount + delta.denominatorCount === 0) {
      warnings.push("Proposed rules would filter out ALL denominator records — result is empty.");
    }

    return warnings;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
