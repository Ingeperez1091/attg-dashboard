import { beforeEach, describe, expect, it } from "vitest";
import { GET as getApplications } from "@/app/api/applications/route";
import { GET as getRoles } from "@/app/api/roles/route";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("integration - SEC-005 metadata endpoint authentication", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    delete process.env.DEV_SESSION_USER_ID;
    resetRuntimeRepositoriesForTests();
  });

  describe("/api/applications", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const response = await getApplications(new Request("http://localhost/api/applications"));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("allows authenticated requests with 200", async () => {
      const repositories = getRuntimeRepositories();
      const user = await repositories.users.create({
        username: "app_list_user",
        email: "app-list-user@example.com",
        displayName: "App List User",
        isActive: true,
        actorUserId: "seed"
      });
      await repositories.roles.assignRole(user.userId, "viewer", "seed");

      const response = await getApplications(
        new Request("http://localhost/api/applications", {
          headers: { Cookie: `dev_user_id=${user.userId}` }
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("applications");
    });
  });

  describe("/api/roles", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const response = await getRoles(new Request("http://localhost/api/roles"));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("allows authenticated requests with 200", async () => {
      const repositories = getRuntimeRepositories();
      const user = await repositories.users.create({
        username: "role_list_user",
        email: "role-list-user@example.com",
        displayName: "Role List User",
        isActive: true,
        actorUserId: "seed"
      });
      await repositories.roles.assignRole(user.userId, "viewer", "seed");

      const response = await getRoles(
        new Request("http://localhost/api/roles", {
          headers: { Cookie: `dev_user_id=${user.userId}` }
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("roles");
    });
  });
});
