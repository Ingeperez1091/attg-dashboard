import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertNoStageMutation(sql: string): void {
  const normalized = sql.replace(/\s+/g, " ").toUpperCase();
  expect(normalized.includes("UPDATE STAGE.ENGAGEMENTUSAGERAW")).toBe(false);
  expect(normalized.includes("DELETE FROM STAGE.ENGAGEMENTUSAGERAW")).toBe(false);
  expect(normalized.includes("INSERT INTO STAGE.ENGAGEMENTUSAGERAW")).toBe(false);
}

describe("validation pipeline integration - staging immutability", () => {
  it("does not mutate stage.EngagementUsageRaw in orchestration and filter procedures", () => {
    const migrationsDir = resolve(process.cwd(), "database/migrations");
    const executeMigration = readdirSync(migrationsDir)
      .find((file) => file.endsWith("_create_usp_execute_pipeline_run.sql"));

    expect(executeMigration).toBeDefined();

    const executeSql = readFileSync(
      resolve(migrationsDir, executeMigration!),
      "utf8"
    );
    const filterSql = readFileSync(
      resolve(migrationsDir, "023_create_usp_apply_numerator_filters.sql"),
      "utf8"
    );

    assertNoStageMutation(executeSql);
    assertNoStageMutation(filterSql);
  });
});
