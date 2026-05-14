import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOptionalSession } from "@/lib/auth/session";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { resetAuthContractState } from "./auth-test-helpers";

vi.mock("@/auth", () => ({
  auth: vi.fn()
}));

const mockedAuth = vi.mocked((await import("@/auth")).auth);

describe("contract - auth.js SSO session mapping", () => {
  beforeEach(() => {
    resetAuthContractState();
    vi.clearAllMocks();
  });

  it("maps Auth.js oid to internal session and binds AzureADObjectId on first successful login", async () => {
    const repositories = getRuntimeRepositories();
    const created = await repositories.users.create({
      username: "sso_contract_user",
      email: "sso.contract.user@example.com",
      displayName: "SSO Contract User",
      isActive: true,
      actorUserId: "seed"
    });

    await repositories.roles.assignRole(created.userId, "application_owner", "seed");
    await repositories.userApplications.assign(created.userId, "10000000-0000-0000-0000-000000000001", "seed");

    mockedAuth.mockResolvedValue({
      user: {
        email: "sso.contract.user@example.com"
      },
      oid: "aad-oid-contract-001"
    } as unknown as Awaited<ReturnType<typeof mockedAuth>>);

    const session = await getOptionalSession(new Request("http://localhost/dashboard"), repositories);

    expect(session).not.toBeNull();
    expect(session?.userId).toBe(created.userId);
    expect(session?.role).toBe("application_owner");

    const reloaded = await repositories.users.findById(created.userId);
    expect(reloaded?.azureAdObjectId).toBe("aad-oid-contract-001");
  });

  it("does not rebind when AzureADObjectId is already set to a different oid", async () => {
    const repositories = getRuntimeRepositories();
    const created = await repositories.users.create({
      username: "sso_contract_user_bound",
      email: "sso.contract.user.bound@example.com",
      displayName: "SSO Contract User Bound",
      azureAdObjectId: "aad-oid-original",
      isActive: true,
      actorUserId: "seed"
    });

    await repositories.roles.assignRole(created.userId, "viewer", "seed");

    mockedAuth.mockResolvedValue({
      user: {
        email: "sso.contract.user.bound@example.com"
      },
      oid: "aad-oid-different"
    } as unknown as Awaited<ReturnType<typeof mockedAuth>>);

    const session = await getOptionalSession(new Request("http://localhost/dashboard"), repositories);

    expect(session).toBeNull();

    const reloaded = await repositories.users.findById(created.userId);
    expect(reloaded?.azureAdObjectId).toBe("aad-oid-original");
  });
});
