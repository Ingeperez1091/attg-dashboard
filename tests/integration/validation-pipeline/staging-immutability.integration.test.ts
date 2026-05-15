import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertNoStageMutation(sql: string): void {
  const normalized = sql.replace(/\s+/g, " ").toUpperCase();
  expect(normalized.includes("UPDATE STAGE.ENGAGEMENTUSAGERAW")).toBe(false);
  expect(normalized.includes("DELETE FROM STAGE.ENGAGEMENTUSAGERAW")).toBe(false);
  expect(normalized.includes("INSERT INTO STAGE.ENGAGEMENTUSAGERAW")).toBe(false);
}

describe("validation pipeline integration - staging immutability", () => {
  it("does not mutate stage.EngagementUsageRaw in orchestration and filter procedures", () => {
    const executeSql = readFileSync(
      resolve(process.cwd(), "database/migrations/024_create_usp_execute_pipeline_run.sql"),
      "utf8"
    );
    const filterSql = readFileSync(
      resolve(process.cwd(), "database/migrations/023_create_usp_apply_numerator_filters.sql"),
      "utf8"
    );

    assertNoStageMutation(executeSql);
    assertNoStageMutation(filterSql);
  });
});
