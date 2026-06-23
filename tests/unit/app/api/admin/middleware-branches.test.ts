import { beforeEach, describe, expect, it } from "vitest";
import { withAdminGuard } from "@/app/api/admin/users/middleware";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("admin/users middleware - resolveRepositories branches", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("accepts a function that returns repositories", async () => {
    const handler = withAdminGuard(async () => {
      return Response.json({ ok: true }, { status: 200 });
    }, getRuntimeRepositories);

    const response = await handler(new Request("http://localhost/api/admin/users"));
    expect(response.status).toBe(200);
  });

  it("accepts a plain object as repositories", async () => {
    const repos = getRuntimeRepositories();
    const handler = withAdminGuard(async () => {
      return Response.json({ ok: true }, { status: 200 });
    }, repos);

    const response = await handler(new Request("http://localhost/api/admin/users"));
    expect(response.status).toBe(200);
  });
});
