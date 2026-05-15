import { DashboardUsageView } from "@/core/domain/entities/DashboardUsageView";

export interface DashboardUsageQueryDto {
  subServiceLine?: string;
  runId?: string;
}

export interface DashboardUsageStateDto {
  latestCompletedRunId: string | null;
  activeRun: {
    runId: string;
    status: "Queued" | "Processing";
    startTime: string | null;
  } | null;
  isRecalculating: boolean;
}

export type DashboardUsageResponseDto = DashboardUsageView;
