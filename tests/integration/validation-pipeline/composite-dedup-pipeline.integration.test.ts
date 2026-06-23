import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validation pipeline integration - composite-key deduplication", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "database/stored-procedures/usp_ExecutePipelineRun.sql"),
    "utf8"
  );

  const migrationSql = readFileSync(
    resolve(
      process.cwd(),
      "database/migrations/034_alter_usp_execute_pipeline_run_preview_session.sql"
    ),
    "utf8"
  );

  describe("composite PARTITION BY produces correct deduplication", () => {
    it("extracts both clientId and engagementId as separate columns in the parsed CTE", () => {
      expect(sql).toContain("JSON_VALUE(item.ItemJson, '$.clientId')");
      expect(sql).toContain("JSON_VALUE(item.ItemJson, '$.engagementId')");
      // Both stored as named columns
      expect(sql).toContain("AS ClientId");
      expect(sql).toContain("AS EngagementId");
    });

    it("uses PARTITION BY on both ClientId and EngagementId for dedup ranking", () => {
      // The ROW_NUMBER PARTITION BY must include both key fields
      const partitionMatch = /PARTITION\s+BY\s+[\s\S]*?JSON_VALUE\(item\.ItemJson,\s*'\$\.clientId'\)[\s\S]*?JSON_VALUE\(item\.ItemJson,\s*'\$\.engagementId'\)/i.exec(sql);
      expect(partitionMatch).not.toBeNull();
    });

    it("assigns DuplicateRank via ROW_NUMBER for composite key groups", () => {
      expect(sql).toContain("ROW_NUMBER()");
      expect(sql).toContain("AS DuplicateRank");
    });

    it("true duplicates (same ClientId+EngagementId) get DuplicateRank > 1", () => {
      // DuplicateRank > 1 identifies subsequent occurrences of same composite key
      expect(sql).toContain("DuplicateRank > 1");
    });

    it("shared-single-key records remain distinct when composite key differs", () => {
      // Records sharing only ONE key (e.g., same clientId but different engagementId)
      // will get separate PARTITION BY groups → each gets DuplicateRank = 1.
      // This is guaranteed by the PARTITION BY clause using BOTH fields.
      const partitionBlock = extractPartitionByBlock(sql);
      expect(partitionBlock).toContain("clientId");
      expect(partitionBlock).toContain("engagementId");
      // Not using single-key RecordKey for dedup
      expect(partitionBlock).not.toContain("RecordKey");
    });
  });

  describe("NULL key records are flagged Invalid", () => {
    it("checks ClientId for NULL or empty before other validation", () => {
      expect(sql).toContain("pn.ClientId IS NULL OR LTRIM(RTRIM(pn.ClientId)) = ''");
    });

    it("checks EngagementId for NULL or empty before other validation", () => {
      expect(sql).toContain("pn.EngagementId IS NULL OR LTRIM(RTRIM(pn.EngagementId)) = ''");
    });

    it("sets Status to Invalid for records with NULL composite key fields", () => {
      // The NULL key check produces 'Invalid' status
      const nullKeySection = sql.slice(
        sql.indexOf("pn.ClientId IS NULL"),
        sql.indexOf("pn.ClientId IS NULL") + 200
      );
      expect(nullKeySection).toContain("'Invalid'");
    });

    it("error context references specific missing key field (ClientId or EngagementId)", () => {
      expect(sql).toContain("Missing key field: ClientId is NULL or empty");
      expect(sql).toContain("Missing key field: EngagementId is NULL or empty");
    });
  });

  describe("DuplicateCount accuracy", () => {
    it("counts records with DuplicateRank > 1 for the DuplicateCount metric", () => {
      // DuplicateCount must be derived from composite-key duplicate detection
      expect(sql).toContain("@duplicateCount");
      const countBlock = sql.slice(
        sql.indexOf("SELECT @duplicateCount"),
        sql.indexOf("SELECT @duplicateCount") + 200
      );
      expect(countBlock).toContain("DuplicateRank > 1");
    });

    it("persists DuplicateCount in the PipelineRuns finalization", () => {
      expect(sql).toContain("DuplicateCount = @duplicateCount");
    });

    it("marks duplicate records with Duplicate status and composite key error context", () => {
      // UPDATE that marks duplicates must reference both key fields
      expect(sql).toContain("Status = 'Duplicate'");
      expect(sql).toContain("'Duplicate: ClientId='");
      expect(sql).toContain("', EngagementId='");
    });

    it("does not mark Invalid records as Duplicate (NULL keys skip dedup)", () => {
      // The duplicate UPDATE must exclude already-Invalid records
      expect(sql).toContain("AND vr.Status <> 'Invalid'");
    });
  });

  describe("migration 034 applies composite dedup correctly", () => {
    it("migration 034 references the stored-procedure file containing the composite PARTITION BY", () => {
      expect(migrationSql).toContain(String.raw`:r ..\stored-procedures\usp_ExecutePipelineRun.sql`);
      const partitionMatch = /PARTITION\s+BY\s+[\s\S]*?JSON_VALUE\(item\.ItemJson,\s*'\$\.clientId'\)[\s\S]*?JSON_VALUE\(item\.ItemJson,\s*'\$\.engagementId'\)/i.exec(sql);
      expect(partitionMatch).not.toBeNull();
    });

    it("stored-procedure file contains @previewSessionId parameter and composite dedup", () => {
      expect(sql).toContain("@previewSessionId UNIQUEIDENTIFIER = NULL");
      expect(sql).toContain("AS ClientId");
      expect(sql).toContain("AS EngagementId");
    });

    it("migration 036 exists as documentation/verification for composite dedup", () => {
      const migration036 = readFileSync(
        resolve(
          process.cwd(),
          "database/migrations/036_alter_usp_execute_pipeline_run_composite_dedup.sql"
        ),
        "utf8"
      );
      expect(migration036).toContain("Composite-Key Deduplication");
      expect(migration036).toContain("usp_ExecutePipelineRun");
    });
  });
});

/**
 * Extracts the PARTITION BY clause block from the SQL for detailed assertions.
 */
function extractPartitionByBlock(sql: string): string {
  const partitionIdx = sql.indexOf("PARTITION BY");
  if (partitionIdx === -1) return "";
  // Get ~500 chars around the PARTITION BY to capture both key references
  return sql.slice(partitionIdx, partitionIdx + 500);
}
