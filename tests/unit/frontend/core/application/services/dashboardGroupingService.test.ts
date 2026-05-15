import { describe, expect, it } from "vitest";
import { aggregateDashboardGroups } from "@/core/application/services/dashboardGroupingService";

describe("dashboard grouping service unit - aggregation hierarchy", () => {
  it("groups application rows by sub service line and computes rollups", () => {
    const result = aggregateDashboardGroups([
      {
        snapshotId: "snap-1",
        runId: "70000000-0000-0000-0000-000000000001",
        applicationId: "10000000-0000-0000-0000-000000000001",
        applicationName: "Maestro",
        subServiceLine: "BTS",
        calculationDate: "2026-05-07T10:00:00.000Z",
        refreshTimestamp: "2026-05-07T10:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 100,
        numeratorCount: 80,
        matchedCount: 75,
        adoptionPct: 80,
        denominatorRevenue: 1000,
        numeratorRevenue: 600,
        revenuePct: 60,
        avgEngagement: 71,
        investmentAmount: 10
      },
      {
        snapshotId: "snap-2",
        runId: "70000000-0000-0000-0000-000000000001",
        applicationId: "10000000-0000-0000-0000-000000000002",
        applicationName: "Prodigy",
        subServiceLine: "BTS",
        calculationDate: "2026-05-07T10:00:00.000Z",
        refreshTimestamp: "2026-05-07T10:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 50,
        numeratorCount: 20,
        matchedCount: 20,
        adoptionPct: 40,
        denominatorRevenue: 500,
        numeratorRevenue: 100,
        revenuePct: 20,
        avgEngagement: 22,
        investmentAmount: 5
      }
    ]);

    expect(result.subServiceLineGroups).toHaveLength(1);
    expect(result.subServiceLineGroups[0].displayName).toBe("BTS");
    expect(result.subServiceLineGroups[0].children).toHaveLength(2);
    expect(result.subServiceLineGroups[0].metrics.denominatorCount).toBe(150);
    expect(result.subServiceLineGroups[0].metrics.numeratorCount).toBe(100);
    expect(result.portfolioMetrics.revenuePct).toBeCloseTo(46.67, 2);
  });

  it("falls back null sub service line values to Unassigned", () => {
    const result = aggregateDashboardGroups([
      {
        snapshotId: "snap-3",
        runId: "70000000-0000-0000-0000-000000000002",
        applicationId: "10000000-0000-0000-0000-000000000003",
        applicationName: "Vector",
        subServiceLine: null,
        calculationDate: "2026-05-07T11:00:00.000Z",
        refreshTimestamp: "2026-05-07T11:00:01.000Z",
        metricDefinitionVersion: "EPIC-007-v1",
        denominatorCount: 10,
        numeratorCount: 5,
        matchedCount: 5,
        adoptionPct: 50,
        denominatorRevenue: 100,
        numeratorRevenue: 40,
        revenuePct: 40,
        avgEngagement: null,
        investmentAmount: null
      }
    ]);

    expect(result.subServiceLineGroups[0].displayName).toBe("Unassigned");
    expect(result.subServiceLineGroups[0].subServiceLine).toBeNull();
  });
});