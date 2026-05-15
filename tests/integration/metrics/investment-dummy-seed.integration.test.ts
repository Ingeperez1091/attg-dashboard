import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("metrics integration - idempotent synthetic seed behavior", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "database/seed/seed-investment-dummy-facts.sql"),
    "utf8"
  );

  it("uses SyntheticBusinessKey merge semantics to avoid duplicate inserts", () => {
    expect(sql).toContain("MERGE app.InvestmentDummyFacts AS target");
    expect(sql).toContain("ON target.SyntheticBusinessKey = source.SyntheticBusinessKey");
    expect(sql).toContain("WHEN MATCHED THEN");
    expect(sql).toContain("WHEN NOT MATCHED THEN");
  });

  it("retains deterministic synthetic labeling and business key seed formula", () => {
    expect(sql).toContain("CAST(1 AS BIT) AS IsSynthetic");
    expect(sql).toContain("'|EPIC007') AS SyntheticBusinessKey");
    expect(sql).toContain("@sourceBatchId AS SourceBatchId");
  });
});
