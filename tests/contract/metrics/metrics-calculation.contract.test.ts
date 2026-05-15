import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("metrics contract - KPI calculation SQL semantics", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_CalculateMetrics.sql"),
    "utf8"
  );

  it("uses divide-by-zero-safe formula guards for adoption and revenue percentages", () => {
    expect(sql).toContain("NULLIF(@denominatorCount, 0)");
    expect(sql).toContain("NULLIF(@denominatorRevenue, 0)");
    expect(sql).toContain("SET @adoptionPct");
    expect(sql).toContain("SET @revenuePct");
  });

  it("requires filtered denominator input and uses RevenueMetric for aggregated revenue", () => {
    expect(sql).toContain("#FilteredDenom");
    expect(sql).toContain("THROW 51015");
    expect(sql).toContain("QUOTENAME(@revenueMetric)");
    expect(sql).not.toContain("FROM app.vw_DenominatorLocal");
  });

  it("writes one immutable metric snapshot row with lineage metadata", () => {
    expect(sql).toContain("INSERT INTO app.MetricSnapshots");
    expect(sql).toContain("RunId");
    expect(sql).toContain("MetricDefinitionVersion");
    expect(sql).toContain("FilterRuleSnapshotId");
    expect(sql).toContain("SourceBatchId");
    expect(sql).toContain("RefreshTimestamp");
  });

  it("fails when a run already has a snapshot to enforce append-only per-run semantics", () => {
    expect(sql).toContain("Metric snapshot already exists for this pipeline run.");
    expect(sql).toContain("THROW 51013");
  });
});
