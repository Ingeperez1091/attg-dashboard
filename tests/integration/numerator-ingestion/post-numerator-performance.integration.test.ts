import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/numerator/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";
import { resetNumeratorIngestionRepositoryForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("numerator ingestion integration - performance", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetNumeratorIngestionRepositoryForTests();
  });

  it("meets 5-second acknowledgment threshold for sampled requests", async () => {
    const durations: number[] = [];

    for (let i = 0; i < 20; i += 1) {
      const started = Date.now();
      const response = await POST(new Request("http://localhost/api/numerator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: "10000000-0000-0000-0000-000000000001",
          payload: [{ seq: i }]
        })
      }));
      durations.push(Date.now() - started);
      expect(response.status).toBe(201);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    expect(p95).toBeLessThan(5000);
  });
});
