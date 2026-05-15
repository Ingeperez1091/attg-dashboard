import { beforeEach, describe, expect, it } from "vitest";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { resetAuthIntegrationState } from "./auth-test-helpers";

describe("integration - Azure AD object id user lookup and binding", () => {
  beforeEach(() => {
    resetAuthIntegrationState();
  });

  it("finds a user by Azure AD object id after first-login binding", async () => {
    const repositories = getRuntimeRepositories();

    const created = await repositories.users.create({
      username: "integration_sso_lookup",
      email: "integration.sso.lookup@example.com",
      displayName: "Integration SSO Lookup",
      isActive: true,
      actorUserId: "seed"
    });

    const beforeBind = await repositories.users.findByAzureAdObjectId("aad-oid-integration-001");
    expect(beforeBind).toBeNull();

    const bound = await repositories.users.bindAzureAdObjectId(created.userId, "aad-oid-integration-001", "system:sso");
    expect(bound).not.toBeNull();
    expect(bound?.azureAdObjectId).toBe("aad-oid-integration-001");

    const byOid = await repositories.users.findByAzureAdObjectId("aad-oid-integration-001");
    expect(byOid?.userId).toBe(created.userId);
  });

  it("does not overwrite an existing Azure AD object id after initial binding", async () => {
    const repositories = getRuntimeRepositories();

    const created = await repositories.users.create({
      username: "integration_sso_bound",
      email: "integration.sso.bound@example.com",
      displayName: "Integration SSO Bound",
      azureAdObjectId: "aad-oid-original",
      isActive: true,
      actorUserId: "seed"
    });

    const attempted = await repositories.users.bindAzureAdObjectId(created.userId, "aad-oid-new", "system:sso");

    expect(attempted?.azureAdObjectId).toBe("aad-oid-original");

    const byOriginalOid = await repositories.users.findByAzureAdObjectId("aad-oid-original");
    expect(byOriginalOid?.userId).toBe(created.userId);

    const byNewOid = await repositories.users.findByAzureAdObjectId("aad-oid-new");
    expect(byNewOid).toBeNull();
  });
});
