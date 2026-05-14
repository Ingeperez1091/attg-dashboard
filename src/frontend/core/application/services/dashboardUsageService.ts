import {
  DashboardUsageQueryDto,
  DashboardUsageResponseDto,
  DashboardUsageStateDto
} from "@/core/application/dto/dashboardUsageDto";
import {
  mapDashboardUsageErrorResponse,
  mapDashboardUsageResponse
} from "@/core/application/dto/dashboardUsageMapper";
import {
  aggregateDashboardGroups,
  normalizeDashboardSubServiceLineKey
} from "@/core/application/services/dashboardGroupingService";
import { resolveDashboardState } from "@/core/application/services/dashboardStateService";
import { DashboardScope } from "@/core/domain/entities/DashboardUsageView";
import { DashboardUsageRepository } from "@/core/domain/repositories/dashboardUsageRepository";
import { IApplicationRepository } from "@/core/domain/repositories/IApplicationRepository";
import { SessionEntity } from "@/core/domain/entities/SessionEntity";
import { resolveDashboardScope } from "@/lib/auth/dashboardScope";

function normalizeSelectedSubServiceLine(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? normalizeDashboardSubServiceLineKey(trimmed) : null;
}

export class DashboardUsageService {
  constructor(
    private readonly repository: DashboardUsageRepository,
    private readonly applicationsRepository: IApplicationRepository
  ) {}

  private async resolveScope(
    session: SessionEntity,
    selectedSubServiceLine: string | null | undefined
  ): Promise<DashboardScope> {
    const activeApplications = await this.applicationsRepository.listActive();
    return resolveDashboardScope(session, {
      availableApplicationIds: activeApplications.map((application) => application.applicationId),
      selectedSubServiceLine: selectedSubServiceLine ?? null
    });
  }

  async getUsage(session: SessionEntity, query: DashboardUsageQueryDto): Promise<DashboardUsageResponseDto> {
    const scope = await this.resolveScope(session, query.subServiceLine ?? null);

    const rows = await this.repository.listUsageRows({
      applicationIds: scope.applicationIds,
      runId: query.runId
    });

    const selectedSubServiceLine = normalizeSelectedSubServiceLine(scope.selectedSubServiceLine);
    const scopedRows = selectedSubServiceLine
      ? rows.filter((row) => normalizeDashboardSubServiceLineKey(row.subServiceLine) === selectedSubServiceLine)
      : rows;

    const runContext = await this.repository.getRunContext({
      applicationIds: scope.applicationIds
    });
    const grouping = aggregateDashboardGroups(scopedRows);
    const state = resolveDashboardState({ rows: scopedRows, runContext });

    return mapDashboardUsageResponse({
      scope,
      rows: scopedRows,
      grouping,
      runContext,
      state
    });
  }

  async getState(session: SessionEntity): Promise<DashboardUsageStateDto> {
    const scope = await this.resolveScope(session, null);
    const runContext = await this.repository.getRunContext({
      applicationIds: scope.applicationIds
    });

    return {
      latestCompletedRunId: runContext.latestCompletedRunId,
      activeRun: runContext.activeRun
        ? {
            runId: runContext.activeRun.runId,
            status: runContext.activeRun.status,
            startTime: runContext.activeRun.startTime
          }
        : null,
      isRecalculating: Boolean(runContext.activeRun)
    };
  }

  async getErrorUsage(session: SessionEntity, query: DashboardUsageQueryDto): Promise<DashboardUsageResponseDto> {
    const scope = await this.resolveScope(session, query.subServiceLine ?? null);
    return mapDashboardUsageErrorResponse({ scope });
  }
}
