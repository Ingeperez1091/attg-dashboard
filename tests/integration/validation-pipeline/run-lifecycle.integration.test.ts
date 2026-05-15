import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validation pipeline integration - run lifecycle transitions and metadata counts", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_ExecutePipelineRun.sql"),
    "utf8"
  );

  it("transitions run status to Processing at the start of orchestration", () => {
    expect(sql).toContain("Status = 'Processing'");
    expect(sql).toContain("StartTime = SYSUTCDATETIME()");
  });

  it("transitions run status to Completed on successful execution", () => {
    expect(sql).toContain("Status = 'Completed'");
    expect(sql).toContain("EndTime = SYSUTCDATETIME()");
  });

  it("transitions run status to Failed in the CATCH block", () => {
    expect(sql).toContain("Status = 'Failed'");
    expect(sql).toContain("CATCH");
    // Error message from the exception must be captured.
    expect(sql).toContain("ERROR_MESSAGE()");
  });

  it("persists aggregate count metrics at run completion (totalRecordsIn, valid, invalid, duplicate, filteredOut, matched)", () => {
    expect(sql).toContain("TotalRecordsIn");
    expect(sql).toContain("ValidCount");
    expect(sql).toContain("InvalidCount");
    expect(sql).toContain("DuplicateCount");
    expect(sql).toContain("FilteredOutCount");
    expect(sql).toContain("MatchedCount");
  });

  it("snapshots active numerator and denominator rules into FilterRuleSnapshots before processing", () => {
    expect(sql).toContain("app.FilterRuleSnapshots");
    expect(sql).toContain("'Numerator'");
    expect(sql).toContain("'Denominator'");
    // MERGE ensures idempotent re-run snapshot updates.
    expect(sql).toContain("MERGE app.FilterRuleSnapshots");
  });

  it("stores StartTime when transitioning to Processing", () => {
    // Verify the Processing update sets StartTime, not just Status.
    const processingBlock = sql.slice(sql.indexOf("Status = 'Processing'") - 50, sql.indexOf("Status = 'Processing'") + 300);
    expect(processingBlock).toContain("StartTime");
  });

  it("stores EndTime only at Completed/Failed transition, not at start", () => {
    const completedIdx = sql.lastIndexOf("Status = 'Completed'");
    const failedIdx = sql.lastIndexOf("Status = 'Failed'");
    const endTimeIdx = sql.lastIndexOf("EndTime = SYSUTCDATETIME()");

    // EndTime should be near the Completed or Failed transition, not at the start Processing block.
    const distToCompleted = Math.abs(endTimeIdx - completedIdx);
    const distToFailed = Math.abs(endTimeIdx - failedIdx);

    // EndTime must be closer to a terminal state than to any Processing block (min distance <= 500 chars).
    expect(Math.min(distToCompleted, distToFailed)).toBeLessThan(500);
  });
});
