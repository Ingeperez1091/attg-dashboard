import { describe, expect, it } from "vitest";
import { numeratorIngestionRequestSchema } from "@/lib/validation/numeratorIngestionSchema";

describe("numeratorIngestionSchema - branch coverage", () => {
  it("validates payload with nested arrays", () => {
    const result = numeratorIngestionRequestSchema.safeParse({
      applicationId: "10000000-0000-0000-0000-000000000001",
      payload: [["nested", 1], [true, null]]
    });

    expect(result.success).toBe(true);
  });

  it("validates payload with deeply nested objects", () => {
    const result = numeratorIngestionRequestSchema.safeParse({
      applicationId: "10000000-0000-0000-0000-000000000001",
      payload: { level1: { level2: { level3: "deep" } } }
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-uuid applicationId", () => {
    const result = numeratorIngestionRequestSchema.safeParse({
      applicationId: "not-a-uuid",
      payload: {}
    });

    expect(result.success).toBe(false);
  });

  it("validates payload as array of objects", () => {
    const result = numeratorIngestionRequestSchema.safeParse({
      applicationId: "10000000-0000-0000-0000-000000000001",
      payload: [{ key: "value" }, { key: 42 }]
    });

    expect(result.success).toBe(true);
  });
});
