import {
  DashboardRunContext,
  DashboardUsageSnapshotRow
} from "@/core/domain/entities/DashboardUsageView";

export interface DashboardUsageRepository {
  listUsageRows(input: { applicationIds: string[]; runId?: string }): Promise<DashboardUsageSnapshotRow[]>;
  getRunContext(input: { applicationIds: string[] }): Promise<DashboardRunContext>;
}
