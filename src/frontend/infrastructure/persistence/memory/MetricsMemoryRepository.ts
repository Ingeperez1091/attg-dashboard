import {
  MetricHistoryPage,
  MetricHistoryQuery,
  MetricSnapshot,
  PipelineRunMetricsSummary,
  SyntheticInvestmentFact
} from "@/core/domain/entities/MetricSnapshot";
import { IMetricsRepository } from "@/core/domain/repositories/metricsRepository";
import { createStoreAccessor } from "@/infrastructure/persistence/memory/sharedStore";

type MetricsRepoStore = {
  snapshots: MetricSnapshot[];
  runSummaries: PipelineRunMetricsSummary[];
  syntheticFacts: SyntheticInvestmentFact[];
};

const sharedStoreFile = process.env.TEST_METRICS_REPOSITORY_STORE_FILE;

const { getStore, writeStore } = createStoreAccessor<MetricsRepoStore>({
  storeFilePath: sharedStoreFile,
  globalKey: "__dashboardMetricsRepoStore",
  createEmptyStore: () => ({ snapshots: [], runSummaries: [], syntheticFacts: [] })
});

function isWithinRange(snapshot: MetricSnapshot, query: MetricHistoryQuery): boolean {
  const when = new Date(snapshot.calculationDate).getTime();
  const from = query.from ? new Date(query.from).getTime() : Number.NEGATIVE_INFINITY;
  const to = query.to ? new Date(query.to).getTime() : Number.POSITIVE_INFINITY;
  return when >= from && when <= to;
}

export class MetricsMemoryRepository implements IMetricsRepository {
  async getLatestSnapshot(applicationId: string, runId?: string): Promise<MetricSnapshot | null> {
    const snapshots = getStore().snapshots
      .filter((snapshot) => snapshot.applicationId === applicationId)
      .filter((snapshot) => (runId ? snapshot.runId === runId : true))
      .sort((a, b) => new Date(b.calculationDate).getTime() - new Date(a.calculationDate).getTime());

    return snapshots[0] ?? null;
  }

  async listSnapshotHistory(query: MetricHistoryQuery): Promise<MetricHistoryPage> {
    const snapshots = getStore().snapshots
      .filter((snapshot) => snapshot.applicationId === query.applicationId)
      .filter((snapshot) => (query.runId ? snapshot.runId === query.runId : true))
      .filter((snapshot) => isWithinRange(snapshot, query))
      .sort((a, b) => new Date(b.calculationDate).getTime() - new Date(a.calculationDate).getTime());

    const start = (query.page - 1) * query.pageSize;
    const items = snapshots.slice(start, start + query.pageSize);

    return {
      items,
      total: snapshots.length,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async getRunMetricsSummary(runId: string): Promise<PipelineRunMetricsSummary | null> {
    const explicit = getStore().runSummaries.find((summary) => summary.runId === runId);
    if (explicit) {
      return explicit;
    }

    const snapshot = getStore().snapshots.find((row) => row.runId === runId);
    if (!snapshot) {
      return null;
    }

    return {
      runId,
      applicationId: snapshot.applicationId,
      status: "Completed",
      startTime: null,
      endTime: null,
      matchedCount: snapshot.matchedCount,
      snapshot
    };
  }

  async listSyntheticInvestmentFacts(applicationId: string): Promise<SyntheticInvestmentFact[]> {
    return getStore().syntheticFacts
      .filter((row) => row.applicationId === applicationId && row.isSynthetic)
      .sort((a, b) => new Date(b.calculationDate).getTime() - new Date(a.calculationDate).getTime());
  }

  addSnapshotForTests(snapshot: MetricSnapshot): void {
    const store = getStore();
    store.snapshots.push(snapshot);
    writeStore(store);
  }

  setRunSummaryForTests(summary: PipelineRunMetricsSummary): void {
    const store = getStore();
    const existingIndex = store.runSummaries.findIndex((row) => row.runId === summary.runId);
    if (existingIndex >= 0) {
      store.runSummaries[existingIndex] = summary;
    } else {
      store.runSummaries.push(summary);
    }
    writeStore(store);
  }

  addSyntheticFactForTests(fact: SyntheticInvestmentFact): void {
    const store = getStore();
    store.syntheticFacts.push(fact);
    writeStore(store);
  }
}
