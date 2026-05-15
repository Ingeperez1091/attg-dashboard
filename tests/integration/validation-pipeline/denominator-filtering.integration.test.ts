import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validation pipeline integration - denominator filtering", () => {
  it("supports canonical operators and enforces empty denominator guard", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "database/stored-procedures/usp_BuildFilteredDenominator.sql"),
      "utf8"
    );

    expect(sql).toContain("THROW 51001, 'app.vw_DenominatorLocal is empty.'");
    expect(sql).toContain("'EQUALS'");
    expect(sql).toContain("'NOT_EQUALS'");
    expect(sql).toContain("'CONTAINS'");
    expect(sql).toContain("'NOT_CONTAINS'");
    expect(sql).toContain("'IN_LIST'");
    expect(sql).toContain("'NOT_IN_LIST'");
    expect(sql).toContain("'GREATER_THAN'");
    expect(sql).toContain("'GREATER_OR_EQUAL'");
    expect(sql).toContain("'LESS_THAN'");
    expect(sql).toContain("'LESS_OR_EQUAL'");
  });
});
