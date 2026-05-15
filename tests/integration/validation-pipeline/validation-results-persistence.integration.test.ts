import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validation pipeline integration - validation result persistence with error context", () => {
  const orchestratorSql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_ExecutePipelineRun.sql"),
    "utf8"
  );

  const filterSql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_ApplyNumeratorFilters.sql"),
    "utf8"
  );

  it("persists one ValidationResult row per staged record via INSERT INTO app.ValidationResults", () => {
    expect(orchestratorSql).toContain("INSERT INTO app.ValidationResults");
    // Linked to the pipeline run by PipelineRunId.
    expect(orchestratorSql).toContain("PipelineRunId");
    // Linked to staging source by StageId.
    expect(orchestratorSql).toContain("StageId");
  });

  it("persists Invalid status with explicit reason when RecordKey is missing or blank", () => {
    expect(orchestratorSql).toContain("'Missing Engagement/Client ID'");
    expect(orchestratorSql).toContain("pn.RecordKey IS NULL OR LTRIM(RTRIM(pn.RecordKey)) = ''");
  });

  it("does not persist Duplicate status for repeated numerator keys", () => {
    expect(orchestratorSql).not.toContain("'Duplicate match key in staged batch'");
    expect(orchestratorSql).not.toContain("THEN 'Duplicate'");
  });

  it("persists Invalid status with explicit reason when engagement ID is not found in denominator", () => {
    expect(orchestratorSql).toContain("CONCAT('Engagement ID ', pn.RecordKey, ' not found in denominator')");
  });

  it("persists Invalid status with explicit reason when client ID is not found in denominator", () => {
    expect(orchestratorSql).toContain("CONCAT('Client ID ', pn.RecordKey, ' not found in denominator')");
  });

  it("persists FilteredOut status with aggregated rule-failure reason via usp_ApplyNumeratorFilters", () => {
    expect(filterSql).toContain("'FilteredOut'");
    expect(filterSql).toContain("ErrorMessage = f.ErrorMessage");
    expect(filterSql).toContain("'Failed filter rule(s): '");
    expect(filterSql).toContain("STRING_AGG");
  });

  it("clears existing ValidationResults before re-inserting so reruns are idempotent", () => {
    expect(orchestratorSql).toContain("DELETE FROM app.ValidationResults");
    expect(orchestratorSql).toContain("PipelineRunId = @runId");

    // DELETE must precede INSERT for idempotency.
    const deleteIdx = orchestratorSql.indexOf("DELETE FROM app.ValidationResults");
    const insertIdx = orchestratorSql.indexOf("INSERT INTO app.ValidationResults");
    expect(deleteIdx).toBeLessThan(insertIdx);
  });

  it("every result row is linked to the run (PipelineRunId) and to staging data (StageId)", () => {
    // INSERT must include both PipelineRunId and StageId columns.
    const insertBlock = orchestratorSql.slice(
      orchestratorSql.indexOf("INSERT INTO app.ValidationResults"),
      orchestratorSql.indexOf("FROM #ParsedNumerator pn")
    );

    expect(insertBlock).toContain("PipelineRunId");
    expect(insertBlock).toContain("StageId");
    expect(insertBlock).toContain("ApplicationId");
    expect(insertBlock).toContain("RecordKey");
    expect(insertBlock).toContain("Status");
    expect(insertBlock).toContain("ErrorMessage");
  });

  it("Valid records have NULL ErrorMessage — only non-valid records carry error context", () => {
    // The CASE for status writes NULL ErrorMessage for Valid records.
    expect(orchestratorSql).toContain("ELSE NULL");
    expect(orchestratorSql).toContain("ELSE 'Valid'");
  });

  it("matching preserves row-level valid numerator items while joining to distinct denominator keys", () => {
    expect(orchestratorSql).toContain("ROW_NUMBER() OVER");
    expect(orchestratorSql).toContain("ORDER BY eur.StageId DESC");
    expect(orchestratorSql).toContain("DuplicateRank");
    expect(orchestratorSql).toContain("CREATE TABLE #ValidatedNumerator");
    expect(orchestratorSql).toContain("INNER JOIN app.ValidationResults vr");
    expect(orchestratorSql).toContain("SELECT DISTINCT");
    expect(orchestratorSql).toContain("AS DenominatorKey");
  });

  it("StageId is cast to NVARCHAR(36) for cross-table join compatibility", () => {
    expect(orchestratorSql).toContain("CAST(pn.StageId AS NVARCHAR(36))");
  });
});
