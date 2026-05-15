import {
  LatestMetricSnapshotResponseDto,
  MetricHistoryResponseDto,
  PipelineRunMetricsResponseDto,
  SyntheticInvestmentContextDto
} from "@/core/application/dto/metricsDto";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import { IApplicationRepository } from "@/core/domain/repositories/IApplicationRepository";
import { IMetricsRepository } from "@/core/domain/repositories/metricsRepository";
import { AppError } from "@/lib/api/error-handler";
import {
  assertCanViewMetricsForApplication,
  assertCanViewMetricsForRun
} from "@/lib/auth/authorization";

function toSnapshotDto(snapshot: {
  snapshotId: string;
  applicationId: string;
  applicationName: string | null;
  runId: string;
  calculationDate: string;
  denominatorCount: number;
  numeratorCount: number;
  matchedCount: number;
  adoptionPct: number;
  denominatorRevenue: number | null;
  numeratorRevenue: number | null;
  revenuePct: number;
  avgEngagement: number | null;
  metricDefinitionVersion: string;
  refreshTimestamp: string;
  sourceBatchId: string | null;
  filterRuleSnapshotId: string | null;
}, syntheticInvestment: SyntheticInvestmentContextDto | null): LatestMetricSnapshotResponseDto {
  return {
    snapshotId: snapshot.snapshotId,
    applicationId: snapshot.applicationId,
    applicationName: snapshot.applicationName,
    runId: snapshot.runId,
    calculationDate: snapshot.calculationDate,
    denominatorCount: snapshot.denominatorCount,
    numeratorCount: snapshot.numeratorCount,
    matchedCount: snapshot.matchedCount,
    adoptionPct: snapshot.adoptionPct,
    denominatorRevenue: snapshot.denominatorRevenue,
    numeratorRevenue: snapshot.numeratorRevenue,
    revenuePct: snapshot.revenuePct,
    onTarget: snapshot.adoptionPct > 70,
    avgEngagement: snapshot.avgEngagement,
    metricDefinitionVersion: snapshot.metricDefinitionVersion,
    refreshTimestamp: snapshot.refreshTimestamp,
    sourceBatchId: snapshot.sourceBatchId,
    filterRuleSnapshotId: snapshot.filterRuleSnapshotId,
    syntheticInvestment
  };
}

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export class MetricsRetrievalService {
  constructor(
    private readonly metricsRepository: IMetricsRepository,
    private readonly applicationsRepository: IApplicationRepository
  ) {}

  private async getApplicationName(applicationId: string): Promise<string | null> {
    const activeApps = await this.applicationsRepository.listActive();
    const app = activeApps.find((candidate) => candidate.applicationId === applicationId);
    return app?.applicationName ?? null;
  }

  async getLatestSnapshot(
    session: SessionEntity,
    input: { applicationId: string; runId?: string; includeSynthetic?: boolean }
  ): Promise<LatestMetricSnapshotResponseDto | null> {
    assertCanViewMetricsForApplication(session, input.applicationId);

    if (input.includeSynthetic && isProductionEnvironment()) {
      throw new AppError(403, "FORBIDDEN", "Synthetic investment data is not available in production.");
    }

    const snapshot = await this.metricsRepository.getLatestSnapshot(input.applicationId, input.runId);
    if (!snapshot) {
      return null;
    }

    let syntheticContext: SyntheticInvestmentContextDto | null = null;
    if (input.includeSynthetic) {
      const syntheticFacts = await this.metricsRepository.listSyntheticInvestmentFacts(input.applicationId);
      const latestFact = syntheticFacts[0] ?? null;
      syntheticContext = latestFact
        ? {
            investmentId: latestFact.investmentId,
            calculationDate: latestFact.calculationDate,
            investmentAmount: latestFact.investmentAmount,
            isSynthetic: true,
            nonAuthoritativeLabel: "NON_AUTHORITATIVE_SYNTHETIC",
            sourceBatchId: latestFact.sourceBatchId
          }
        : null;
    }

    return toSnapshotDto(snapshot, syntheticContext);
  }

  async getRunMetricsSummary(
    session: SessionEntity,
    runId: string
  ): Promise<PipelineRunMetricsResponseDto | null> {
    const summary = await this.metricsRepository.getRunMetricsSummary(runId);
    if (!summary) {
      return null;
    }

    assertCanViewMetricsForRun(session, summary.applicationId);

    return {
      runId: summary.runId,
      applicationId: summary.applicationId,
      status: summary.status,
      startTime: summary.startTime,
      endTime: summary.endTime,
      matchedCount: summary.matchedCount,
      snapshot: summary.snapshot ? toSnapshotDto(summary.snapshot, null) : null
    };
  }

  async getSnapshotHistory(
    session: SessionEntity,
    input: {
      applicationId: string;
      runId?: string;
      from: string | null;
      to: string | null;
      page: number;
      pageSize: number;
    }
  ): Promise<MetricHistoryResponseDto> {
    assertCanViewMetricsForApplication(session, input.applicationId);

    const applicationName = await this.getApplicationName(input.applicationId);
    if (!applicationName) {
      throw new AppError(404, "NOT_FOUND", "Application not found or inactive.");
    }

    const history = await this.metricsRepository.listSnapshotHistory({
      applicationId: input.applicationId,
      runId: input.runId ?? null,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize
    });

    return {
      applicationId: input.applicationId,
      applicationName,
      totalCount: history.total,
      page: history.page,
      pageSize: history.pageSize,
      snapshots: history.items.map((item) => toSnapshotDto(item, null))
    };
  }
}
