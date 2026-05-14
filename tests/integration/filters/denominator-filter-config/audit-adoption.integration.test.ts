import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/denominator/[appId]/settings/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { getAdoptionAuditEntriesForTests } from "@/infrastructure/persistence/memory/AdoptionSettingsMemoryRepository";

describe("integration - adoption settings audit trail", () => {
  const appId = "10000000-0000-0000-0000-000000000001";
  const actorUserId = "30000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = actorUserId;
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("creates an Adoption audit entry on first settings PUT", async () => {
    const response = await PUT(
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

    expect(response.status).toBe(200);

    const entries = getAdoptionAuditEntriesForTests(appId);

    expect(entries).toHaveLength(1);
    expect(entries[0].changeScope).toBe("Adoption");
    expect(entries[0].applicationId).toBe(appId);
    expect(entries[0].actorUserId).toBe(actorUserId);
    expect(entries[0].auditId).toBeTruthy();
    expect(entries[0].changedAt).toBeTruthy();
  });

  it("captures previous settings snapshot in audit entry on settings update", async () => {
    await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adoptionLevel: "Engagement",
          revenueMetric: "ETD_ANSRAmt",
          numeratorSource: "API"
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adoptionLevel: "Client",
          revenueMetric: "FYTD_TERAmt",
          numeratorSource: "Manual"
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    const entries = getAdoptionAuditEntriesForTests(appId);

    expect(entries).toHaveLength(2);

    const firstEntry = entries[0];
    const secondEntry = entries[1];

    expect(firstEntry.previousSettingsJson).toBe("null");

    const previousSettings = JSON.parse(secondEntry.previousSettingsJson) as Record<string, unknown>;
    const newSettings = JSON.parse(secondEntry.newSettingsJson) as Record<string, unknown>;

    expect(previousSettings.adoptionLevel).toBe("Engagement");
    expect(newSettings.adoptionLevel).toBe("Client");
    expect(newSettings.revenueMetric).toBe("FYTD_TERAmt");
  });

  it("each application gets its own Adoption audit trail", async () => {
    const appId2 = "10000000-0000-0000-0000-000000000002";

    await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adoptionLevel: "Engagement",
          revenueMetric: "ETD_ANSRAmt",
          numeratorSource: "API"
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId2}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adoptionLevel: "Client",
          revenueMetric: "FYTD_TERAmt",
          numeratorSource: "Manual"
        })
      }),
      { params: Promise.resolve({ appId: appId2 }) }
    );

    const entriesApp1 = getAdoptionAuditEntriesForTests(appId);
    const entriesApp2 = getAdoptionAuditEntriesForTests(appId2);

    expect(entriesApp1).toHaveLength(1);
    expect(entriesApp2).toHaveLength(1);
    expect(entriesApp1[0].applicationId).toBe(appId);
    expect(entriesApp2[0].applicationId).toBe(appId2);
  });
});
