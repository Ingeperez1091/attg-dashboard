import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validation pipeline integration - id validation outcomes", () => {
  it("contains explicit invalid/valid validation logic in the orchestrator procedure", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "database/stored-procedures/usp_ExecutePipelineRun.sql"),
      "utf8"
    );

    expect(sql).toContain("WHEN pn.RecordKey IS NULL OR LTRIM(RTRIM(pn.RecordKey)) = '' THEN 'Invalid'");
    expect(sql).not.toContain("THEN 'Duplicate'");
    expect(sql).toContain("not found in denominator");
  });
});
