import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/denominator/[appId]/route";
import { PUT as PUTSettings } from "@/app/api/filters/denominator/[appId]/settings/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { getDenominatorAuditEntriesForTests } from "@/infrastructure/persistence/memory/DenominatorFilterMemoryRepository";
import { getAdoptionAuditEntriesForTests } from "@/infrastructure/persistence/memory/AdoptionSettingsMemoryRepository";

describe("contract - audit-sensitive update responses", () => {
  const appId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  describe("PUT /api/filters/denominator/:appId (rules update)", () => {
    it("returns 200 with lastUpdatedAt and lastUpdatedBy on successful rule PUT", async () => {
      const response = await PUT(
        new Request(`http://localhost/api/filters/denominator/${appId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: [
              {
                denominatorModelId: "50000000-0000-0000-0007-000000000000",
                operator: "EQUALS",
                value: "11300"
              }
            ]
          })
        }),
        { params: Promise.resolve({ appId }) }
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.applicationId).toBe(appId);
      expect(body.lastUpdatedAt).toBeTruthy();
      expect(typeof body.lastUpdatedAt).toBe("string");
      expect(body.lastUpdatedBy).toBe("30000000-0000-0000-0000-000000000001");
    });

    it("records a Denominator audit entry after successful rule PUT", async () => {
      await PUT(
        new Request(`http://localhost/api/filters/denominator/${appId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: [
              {
                denominatorModelId: "50000000-0000-0000-000C-000000000000",
                operator: "GREATER_THAN",
                value: "5000"
              }
            ]
          })
        }),
        { params: Promise.resolve({ appId }) }
      );

      const entries = getDenominatorAuditEntriesForTests(appId);

      expect(entries).toHaveLength(1);
      expect(entries[0].applicationId).toBe(appId);
      expect(entries[0].changeScope).toBe("Denominator");
      expect(entries[0].actorUserId).toBe("30000000-0000-0000-0000-000000000001");
      expect(entries[0].newRulesJson).toBeTruthy();
      expect(entries[0].changedAt).toBeTruthy();
    });
  });

  describe("PUT /api/filters/denominator/:appId/settings (adoption update)", () => {
    it("returns 200 with applicationId on successful settings PUT", async () => {
      const response = await PUTSettings(
        new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adoptionLevel: "Engagement",
            revenueMetric: "FYTD_TERAmt",
            numeratorSource: "Manual"
          })
        }),
        { params: Promise.resolve({ appId }) }
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.applicationId).toBe(appId);
      expect(body.adoptionLevel).toBe("Engagement");
    });

    it("records an Adoption audit entry after successful settings PUT", async () => {
      await PUTSettings(
        new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adoptionLevel: "Client",
            revenueMetric: "ETD_ANSRAmt",
            numeratorSource: "API"
          })
        }),
        { params: Promise.resolve({ appId }) }
      );

      const entries = getAdoptionAuditEntriesForTests(appId);

      expect(entries).toHaveLength(1);
      expect(entries[0].applicationId).toBe(appId);
      expect(entries[0].changeScope).toBe("Adoption");
      expect(entries[0].actorUserId).toBe("30000000-0000-0000-0000-000000000001");
      expect(entries[0].newSettingsJson).toBeTruthy();
      expect(entries[0].changedAt).toBeTruthy();
    });
  });
});
