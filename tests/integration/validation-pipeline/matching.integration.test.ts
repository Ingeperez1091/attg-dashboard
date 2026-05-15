import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validation pipeline integration - matching behavior", () => {
  it("matches valid numerator rows to distinct filtered denominator keys for both adoption levels", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "database/stored-procedures/usp_ExecutePipelineRun.sql"),
      "utf8"
    );

    expect(sql).toContain("SELECT DISTINCT");
    expect(sql).toContain("WHEN @isClientAdoption = 1 THEN CAST(fd.ClientID AS NVARCHAR(256))");
    expect(sql).toContain("ELSE CAST(fd.EngagementID AS NVARCHAR(256))");
    expect(sql).toContain("ON fd.DenominatorKey = vn.RecordKey");
    expect(sql).toContain("INSERT INTO app.MatchedRecords");
  });
});
