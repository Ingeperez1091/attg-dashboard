import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("metrics integration - pipeline lifecycle completion gate", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_ExecutePipelineRun.sql"),
    "utf8"
  );

  it("invokes metrics calculation before setting pipeline status to Completed", () => {
    const metricsCall = sql.indexOf("EXEC app.usp_CalculateMetrics");
    const completeStatus = sql.indexOf("Status = 'Completed'");

    expect(metricsCall).toBeGreaterThan(-1);
    expect(completeStatus).toBeGreaterThan(-1);
    expect(metricsCall).toBeLessThan(completeStatus);
  });

  it("marks run as Failed in catch path if lifecycle or metrics calculation fails", () => {
    expect(sql).toContain("BEGIN CATCH");
    expect(sql).toContain("Status = 'Failed'");
    expect(sql).toContain("ERROR_MESSAGE()");
  });

  it("sources matched revenue from the configured metric-dimension JSON path", () => {
    expect(sql).toContain("IsMetricDimension = 1");
    expect(sql).toContain("@normalizedMetricSourcePath");
    expect(sql).toContain("JSON_VALUE(vn.ItemJson, @normalizedMetricSourcePath)");
  });
});
