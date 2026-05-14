import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validation pipeline integration - numerator filter application and filtered-out reasons", () => {
  const filterSql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_ApplyNumeratorFilters.sql"),
    "utf8"
  );

  const orchestratorSql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_ExecutePipelineRun.sql"),
    "utf8"
  );

  it("uses a set-based CROSS JOIN to evaluate all rules against all valid records in one query", () => {
    // Set-based design: no cursor — single pass over all rules × all valid records.
    expect(filterSql).toContain("CROSS JOIN #NumeratorRules");
    expect(filterSql).not.toContain("DECLARE @cursor");
    expect(filterSql).not.toContain("FETCH NEXT");
  });

  it("evaluates only Valid records — leaves Invalid, Duplicate, and FilteredOut records untouched", () => {
    expect(filterSql).toContain("vr.Status = 'Valid'");
    // The update must only target Valid records.
    expect(filterSql).toContain("AND vr.Status = 'Valid'");
  });

  it("marks non-compliant records as FilteredOut with an aggregated error message", () => {
    expect(filterSql).toContain("'FilteredOut'");
    expect(filterSql).toContain("vr.Status = 'FilteredOut'");
    expect(filterSql).toContain("f.ErrorMessage");
  });

  it("aggregates all failed rule details into the error message using STRING_AGG in rule order", () => {
    expect(filterSql).toContain("STRING_AGG");
    expect(filterSql).toContain("WITHIN GROUP (ORDER BY RuleOrder)");
    expect(filterSql).toContain("'Failed filter rule(s): '");
  });

  it("includes all ten canonical operators in the rule evaluation CASE expression", () => {
    const operators = [
      "'EQUALS'", "'NOT_EQUALS'", "'CONTAINS'", "'NOT_CONTAINS'",
      "'IN_LIST'", "'NOT_IN_LIST'",
      "'GREATER_THAN'", "'GREATER_OR_EQUAL'", "'LESS_THAN'", "'LESS_OR_EQUAL'"
    ];

    for (const op of operators) {
      expect(filterSql).toContain(op);
    }
  });

  it("validates all operators upfront and throws on unsupported operators (fail-fast)", () => {
    expect(filterSql).toContain("THROW 51010");
    expect(filterSql).toContain("'Unsupported numerator filter operator.'");
  });

  it("loads numerator rules from app.NumeratorFilterRules joined to app.ApplicationModelFields", () => {
    expect(filterSql).toContain("app.NumeratorFilterRules");
    expect(filterSql).toContain("app.ApplicationModelFields");
    expect(filterSql).toContain("amf.FieldName");
    expect(filterSql).toContain("amf.SourcePath");
  });

  it("uses OPENJSON + JSON_VALUE(SourcePath) to extract values from each staged payload item", () => {
    expect(filterSql).toContain("OPENJSON(");
    expect(filterSql).toContain("payload.ItemJson");
    expect(filterSql).toContain("NormalizedSourcePath");
  });

  it("supports IN_LIST and NOT_IN_LIST operators using STRING_SPLIT for semicolon-delimited values", () => {
    expect(filterSql).toContain("STRING_SPLIT(nr.Value, ';')");
  });

  it("orchestrator invokes usp_ApplyNumeratorFilters after base validation outcomes are written", () => {
    // Numerator filters run after Section 5 (base validation), before matching.
    expect(orchestratorSql).toContain("EXEC app.usp_ApplyNumeratorFilters");
    expect(orchestratorSql).toContain("@filteredOutCount = @filteredOutCount OUTPUT");

    // Filters must run before matching (FilteredOut records excluded from MatchedRecords).
    const filterIdx = orchestratorSql.indexOf("EXEC app.usp_ApplyNumeratorFilters");
    const matchIdx = orchestratorSql.indexOf("INSERT INTO app.MatchedRecords");
    expect(filterIdx).toBeLessThan(matchIdx);
  });

  it("matched records only include records with Valid status — FilteredOut records are excluded", () => {
    // The matching join must restrict to Valid status after filtering step completes.
    // usp_ApplyNumeratorFilters downgrades non-matching Valid→FilteredOut before matching runs.
    expect(orchestratorSql).toContain("vr.Status = 'Valid'");

    // The insert-into-matched-records block must appear after the filter invocation.
    const filterCallIdx = orchestratorSql.indexOf("EXEC app.usp_ApplyNumeratorFilters");
    const matchInsertIdx = orchestratorSql.indexOf("INSERT INTO app.MatchedRecords");
    expect(filterCallIdx).toBeLessThan(matchInsertIdx);

    // The WHERE Status = 'Valid' guard must appear in the SQL after the filter call (any of up to 3 occurrences).
    const sqlAfterFilter = orchestratorSql.slice(filterCallIdx);
    expect(sqlAfterFilter).toContain("vr.Status = 'Valid'");
  });
});
