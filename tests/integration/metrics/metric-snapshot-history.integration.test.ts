import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("metrics integration - immutable snapshot history semantics", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_CalculateMetrics.sql"),
    "utf8"
  );

  it("uses insert-only writes for snapshots", () => {
    expect(sql).toContain("INSERT INTO app.MetricSnapshots");
    expect(sql).not.toContain("UPDATE app.MetricSnapshots");
    expect(sql).not.toContain("DELETE FROM app.MetricSnapshots");
  });

  it("enforces one snapshot per run via existence guard", () => {
    expect(sql).toContain("WHERE RunId = @runId");
    expect(sql).toContain("THROW 51013");
  });
});
