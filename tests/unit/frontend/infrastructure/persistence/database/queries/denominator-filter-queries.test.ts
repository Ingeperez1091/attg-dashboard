import { describe, it, expect } from "vitest";
import {
  assertSafeIdentifier,
  buildDenominatorPreviewAggregateQuery,
  DenominatorPreviewModelField,
  DenominatorPreviewRuleInput,
} from "@/infrastructure/persistence/database/queries/denominator-filter-queries";

describe("assertSafeIdentifier", () => {
  it("accepts a simple identifier", () => {
    expect(assertSafeIdentifier("EngagementID")).toBe("[EngagementID]");
  });

  it("accepts a bracketed identifier", () => {
    expect(assertSafeIdentifier("[ETD_ANSRAmt]")).toBe("[ETD_ANSRAmt]");
  });

  it("accepts underscore-prefixed identifier", () => {
    expect(assertSafeIdentifier("_Column1")).toBe("[_Column1]");
  });

  it("rejects SQL injection via semicolon", () => {
    expect(() => assertSafeIdentifier("col; DROP TABLE--")).toThrow("Unsafe SQL identifier rejected");
  });

  it("rejects SQL injection via subquery", () => {
    expect(() => assertSafeIdentifier("col] + (SELECT 1) --")).toThrow("Unsafe SQL identifier rejected");
  });

  it("rejects identifiers with spaces", () => {
    expect(() => assertSafeIdentifier("col name")).toThrow("Unsafe SQL identifier rejected");
  });

  it("rejects empty string", () => {
    expect(() => assertSafeIdentifier("")).toThrow("Unsafe SQL identifier rejected");
  });

  it("rejects identifiers starting with a digit", () => {
    expect(() => assertSafeIdentifier("1column")).toThrow("Unsafe SQL identifier rejected");
  });

  it("rejects identifiers exceeding 128 characters", () => {
    const tooLong = "A" + "b".repeat(128);
    expect(() => assertSafeIdentifier(tooLong)).toThrow("Unsafe SQL identifier rejected");
  });
});

describe("buildDenominatorPreviewAggregateQuery", () => {
  const modelFields: DenominatorPreviewModelField[] = [
    { denominatorModelId: "m1", sourceColumn: "[EngagementServiceCode]" },
    { denominatorModelId: "m2", sourceColumn: "[ETD_ANSRAmt]" },
  ];

  it("builds a valid query with safe identifiers", () => {
    const rules: DenominatorPreviewRuleInput[] = [
      { denominatorModelId: "m1", operator: "EQUALS", value: "TAX" },
    ];

    const result = buildDenominatorPreviewAggregateQuery(rules, modelFields, "ETD_ANSRAmt");
    expect(result.sql).toContain("[EngagementServiceCode] = @p0");
    expect(result.sql).toContain("[ETD_ANSRAmt]");
    expect(result.params).toEqual({ p0: "TAX" });
  });

  it("throws if sourceColumn contains injection payload", () => {
    const maliciousFields: DenominatorPreviewModelField[] = [
      { denominatorModelId: "m1", sourceColumn: "x]; DROP TABLE app.Users;--" },
    ];
    const rules: DenominatorPreviewRuleInput[] = [
      { denominatorModelId: "m1", operator: "EQUALS", value: "anything" },
    ];

    expect(() => buildDenominatorPreviewAggregateQuery(rules, maliciousFields, "ETD_ANSRAmt"))
      .toThrow("Unsafe SQL identifier rejected");
  });

  it("throws if revenueMetric contains injection payload", () => {
    const rules: DenominatorPreviewRuleInput[] = [];

    expect(() => buildDenominatorPreviewAggregateQuery(rules, modelFields, "col] AS x FROM sys.objects--"))
      .toThrow("Unsafe SQL identifier rejected");
  });

  it("throws if revenueMetric contains parentheses", () => {
    const rules: DenominatorPreviewRuleInput[] = [];

    expect(() => buildDenominatorPreviewAggregateQuery(rules, modelFields, "SUM(Amount)"))
      .toThrow("Unsafe SQL identifier rejected");
  });
});
