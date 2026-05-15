import { beforeEach, describe, expect, it } from "vitest";
import { ValidationPipelineMemoryRepository } from "@/infrastructure/persistence/memory/ValidationPipelineMemoryRepository";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("validation pipeline integration - matched record persistence", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    resetRuntimeRepositoriesForTests();
  });

  it("persists and retrieves matched records by run id", async () => {
    const repository = new ValidationPipelineMemoryRepository();

    await repository.upsertMatchedRecords([
      {
        matchedId: "71000000-0000-0000-0000-000000000001",
        pipelineRunId: "70000000-0000-0000-0000-000000000201",
        applicationId: "10000000-0000-0000-0000-000000000001",
        numeratorKey: "ENG-001",
        denominatorKey: "ENG-001",
        revenueAmount: 1200,
        stageId: "90000000-0000-0000-0000-000000000001",
        actorUserId: "seed-user"
      },
      {
        matchedId: "71000000-0000-0000-0000-000000000002",
        pipelineRunId: "70000000-0000-0000-0000-000000000201",
        applicationId: "10000000-0000-0000-0000-000000000001",
        numeratorKey: "ENG-002",
        denominatorKey: "ENG-002",
        revenueAmount: 800,
        stageId: "90000000-0000-0000-0000-000000000002",
        actorUserId: "seed-user"
      }
    ]);

    const rows = await repository.listMatchedRecords("70000000-0000-0000-0000-000000000201");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.numeratorKey).sort()).toEqual(["ENG-001", "ENG-002"]);
  });
});
