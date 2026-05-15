import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("contract - numerator boolean SQL handling", () => {
  it("maps boolean rule values true/false to SQL bit semantics (1/0)", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "database/stored-procedures/usp_ApplyNumeratorFilters.sql"),
      "utf8"
    );

    expect(sql).toContain("WHEN LOWER(LTRIM(RTRIM(nr.Value))) IN ('true', '1') THEN CONVERT(BIT, 1)");
    expect(sql).toContain("WHEN LOWER(LTRIM(RTRIM(nr.Value))) IN ('false', '0') THEN CONVERT(BIT, 0)");
    expect(sql).toContain("END AS BooleanRuleValue");
  });

  it("evaluates boolean field equality and inequality using normalized bit values", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "database/stored-procedures/usp_ApplyNumeratorFilters.sql"),
      "utf8"
    );

    expect(sql).toContain("nr.FieldType = 'boolean'");
    expect(sql).toContain("evaluated.BooleanRawValue <> evaluated.BooleanRuleValue");
    expect(sql).toContain("evaluated.BooleanRawValue = evaluated.BooleanRuleValue");
  });
});
