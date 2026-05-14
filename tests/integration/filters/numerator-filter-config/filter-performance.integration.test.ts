import { describe, expect, it } from "vitest";
import { GET as getFilters, PUT as putFilters } from "@/app/api/filters/numerator/[appId]/route";

describe("integration - numerator filter performance", () => {
  it("keeps read/write p95 response times at or below 3 seconds", async () => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";

    const samples = 20;
    const appId = "10000000-0000-0000-0000-000000000005";

    const getDurations: number[] = [];
    for (let i = 0; i < samples; i += 1) {
      const started = Date.now();
      await getFilters(new Request(`http://localhost/api/filters/numerator/${appId}`, { method: "GET" }), {
        params: Promise.resolve({ appId })
      });
      getDurations.push(Date.now() - started);
    }

    const putDurations: number[] = [];
    for (let i = 0; i < samples; i += 1) {
      const started = Date.now();
      await putFilters(new Request(`http://localhost/api/filters/numerator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              applicationModelFieldId: "40000000-0000-0000-0505-000000000005",
              operator: "GREATER_THAN",
              value: "50000"
            }
          ]
        })
      }), {
        params: Promise.resolve({ appId })
      });
      putDurations.push(Date.now() - started);
    }

    getDurations.sort((a, b) => a - b);
    putDurations.sort((a, b) => a - b);

    const getP95 = getDurations[Math.ceil(samples * 0.95) - 1];
    const putP95 = putDurations[Math.ceil(samples * 0.95) - 1];

    expect(getP95).toBeLessThanOrEqual(3000);
    expect(putP95).toBeLessThanOrEqual(3000);
  });
});
