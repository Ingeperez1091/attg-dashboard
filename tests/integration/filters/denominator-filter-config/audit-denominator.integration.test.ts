import { beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/filters/denominator/[appId]/route";
import {
  resetRuntimeDenominatorFilterRepositoryForTests,
  resetRuntimeRepositoriesForTests
} from "@/infrastructure/persistence/runtime/repositories";
import { getDenominatorAuditEntriesForTests } from "@/infrastructure/persistence/memory/DenominatorFilterMemoryRepository";

describe("integration - denominator rule audit trail", () => {
  const appId = "10000000-0000-0000-0000-000000000001";
  const actorUserId = "30000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = actorUserId;
    resetRuntimeRepositoriesForTests();
    resetRuntimeDenominatorFilterRepositoryForTests();
  });

  it("creates a Denominator audit entry on first rule PUT", async () => {
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0007-000000000000",
              operator: "EQUALS",
              value: "11420"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    expect(response.status).toBe(200);

    const entries = getDenominatorAuditEntriesForTests(appId);

    expect(entries).toHaveLength(1);
    expect(entries[0].changeScope).toBe("Denominator");
    expect(entries[0].applicationId).toBe(appId);
    expect(entries[0].actorUserId).toBe(actorUserId);
    expect(entries[0].auditId).toBeTruthy();
    expect(entries[0].changedAt).toBeTruthy();
  });

  it("captures previous rules snapshot in audit entry on rule replacement", async () => {
    await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0007-000000000000",
              operator: "EQUALS",
              value: "11420"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0009-000000000000",
              operator: "NOT_EQUALS",
              value: "Closed"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    const entries = getDenominatorAuditEntriesForTests(appId);

    expect(entries).toHaveLength(2);

    const secondEntry = entries[1];

    expect(secondEntry.changeScope).toBe("Denominator");

    const previousRules = JSON.parse(secondEntry.previousRulesJson) as unknown[];
    const newRules = JSON.parse(secondEntry.newRulesJson) as unknown[];

    expect(previousRules).toHaveLength(1);
    expect(newRules).toHaveLength(1);
    expect(JSON.stringify(previousRules)).toContain("11420");
    expect(JSON.stringify(newRules)).toContain("Closed");
  });

  it("stores separate audit entries per application", async () => {
    const appId2 = "10000000-0000-0000-0000-000000000002";

    await PUT(
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

    await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId2}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0009-000000000000",
              operator: "EQUALS",
              value: "Active"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId: appId2 }) }
    );

    const entriesApp1 = getDenominatorAuditEntriesForTests(appId);
    const entriesApp2 = getDenominatorAuditEntriesForTests(appId2);

    expect(entriesApp1).toHaveLength(1);
    expect(entriesApp2).toHaveLength(1);
    expect(entriesApp1[0].applicationId).toBe(appId);
    expect(entriesApp2[0].applicationId).toBe(appId2);
  });

  it("does not create an audit entry when PUT is rejected due to validation failure", async () => {
    const response = await PUT(
      new Request(`http://localhost/api/filters/denominator/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [
            {
              denominatorModelId: "50000000-0000-0000-0001-000000000000",
              operator: "EQUALS",
              value: "blocked"
            }
          ]
        })
      }),
      { params: Promise.resolve({ appId }) }
    );

    expect(response.status).toBe(400);

    const entries = getDenominatorAuditEntriesForTests(appId);

    expect(entries).toHaveLength(0);
  });
});
