import { beforeEach, describe, expect, it } from "vitest";
import { POST as triggerPipelineRun } from "@/app/api/pipeline/run/route";
import { GET as getPipelineRun } from "@/app/api/pipeline/[runId]/route";
import { GET as getMetrics } from "@/app/api/metrics/[appId]/route";
import { resetAuthContractState } from "./auth-test-helpers";

describe("contract - protected API authentication", () => {
  beforeEach(() => {
    resetAuthContractState();
  });

  it("returns 401 for unauthenticated pipeline run trigger requests", async () => {
    const response = await triggerPipelineRun(
      new Request("http://localhost/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: "10000000-0000-0000-0000-000000000001" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "UNAUTHORIZED" });
  });

  it("returns 401 for unauthenticated pipeline run status requests", async () => {
    const response = await getPipelineRun(
      new Request("http://localhost/api/pipeline/70000000-0000-0000-0000-000000000001", { method: "GET" }),
      { params: Promise.resolve({ runId: "70000000-0000-0000-0000-000000000001" }) }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "UNAUTHORIZED" });
  });

  it("returns 401 for unauthenticated metrics requests", async () => {
    const response = await getMetrics(
      new Request("http://localhost/api/metrics/10000000-0000-0000-0000-000000000001", { method: "GET" }),
      { params: Promise.resolve({ appId: "10000000-0000-0000-0000-000000000001" }) }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "UNAUTHORIZED" });
  });
});
