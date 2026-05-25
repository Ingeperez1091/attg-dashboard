import { beforeEach, describe, expect, it } from "vitest";
import { getOptionalSession, getSessionUser } from "@/lib/auth/session";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { createSessionUser, resetAuthIntegrationState } from "./auth-test-helpers";

describe("integration - SEC-001 bearer token rejection", () => {
  beforeEach(() => {
    resetAuthIntegrationState();
  });

  it("rejects a forged Authorization: Bearer <userId> header", async () => {
    const repositories = getRuntimeRepositories();
    const userId = await createSessionUser({ role: "administrator" });

    const session = await getOptionalSession(
      new Request("http://localhost/api/metrics/test", {
        headers: { Authorization: `Bearer ${userId}` }
      }),
      repositories
    );

    expect(session).toBeNull();
  });

  it("throws 401 via getSessionUser when only a forged Bearer header is provided", async () => {
    const repositories = getRuntimeRepositories();
    const userId = await createSessionUser({ role: "application_owner" });

    await expect(
      getSessionUser(
        new Request("http://localhost/api/metrics/test", {
          headers: { Authorization: `Bearer ${userId}` }
        }),
        repositories
      )
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects arbitrary Bearer values that are not real user IDs", async () => {
    const repositories = getRuntimeRepositories();

    const session = await getOptionalSession(
      new Request("http://localhost/api/admin/users", {
        headers: { Authorization: "Bearer totally-fake-token-12345" }
      }),
      repositories
    );

    expect(session).toBeNull();
  });

  it("still resolves valid sessions via dev_user_id cookie when dev bypass is enabled", async () => {
    const repositories = getRuntimeRepositories();
    const userId = await createSessionUser({ role: "application_owner" });

    const session = await getOptionalSession(
      new Request("http://localhost/api/metrics/test", {
        headers: { Cookie: `dev_user_id=${userId}` }
      }),
      repositories
    );

    expect(session).not.toBeNull();
    expect(session?.userId).toBe(userId);
    expect(session?.role).toBe("application_owner");
  });
});
