import { beforeEach, describe, expect, it } from "vitest";
import { GET as getApplications, POST as assignApplications } from "@/app/api/admin/users/[userId]/applications/route";
import { DELETE as deleteAssignment } from "@/app/api/admin/users/[userId]/applications/[applicationId]/route";
import { PUT as assignRole } from "@/app/api/admin/users/[userId]/role/route";
import { POST as createUser } from "@/app/api/admin/users/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("admin route error branches", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  describe("[userId]/applications GET - user not found", () => {
    it("returns 404 when user does not exist", async () => {
      const response = await getApplications(
        new Request("http://localhost"),
        { params: Promise.resolve({ userId: "99999999-0000-0000-0000-000000000099" }) }
      );
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  describe("[userId]/applications POST - validation error", () => {
    it("returns 400 when payload is invalid", async () => {
      const response = await assignApplications(
        new Request("http://localhost/api/admin/users/some-user/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invalidField: true })
        }),
        { params: Promise.resolve({ userId: "30000000-0000-0000-0000-000000000001" }) }
      );
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("[userId]/applications POST - user not found", () => {
    it("returns 404 when target user does not exist", async () => {
      const response = await assignApplications(
        new Request("http://localhost/api/admin/users/nonexistent/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId: "10000000-0000-0000-0000-000000000001" })
        }),
        { params: Promise.resolve({ userId: "99999999-0000-0000-0000-000000000099" }) }
      );
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  describe("[applicationId] DELETE - user not found (null)", () => {
    it("returns 404 when user does not exist", async () => {
      const response = await deleteAssignment(
        new Request("http://localhost", { method: "DELETE" }),
        { params: Promise.resolve({ userId: "99999999-0000-0000-0000-000000000099", applicationId: "10000000-0000-0000-0000-000000000001" }) }
      );
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  describe("[applicationId] DELETE - assignment not found", () => {
    it("returns 404 when application is not assigned", async () => {
      const createResponse = await createUser(
        new Request("http://localhost/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "del_test_user", email: "del-test@example.com", isActive: true })
        })
      );
      const { userId } = await createResponse.json();

      const response = await deleteAssignment(
        new Request("http://localhost", { method: "DELETE" }),
        { params: Promise.resolve({ userId, applicationId: "10000000-0000-0000-0000-000000000001" }) }
      );
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  describe("[userId]/role PUT - user not found", () => {
    it("returns 404 when target user does not exist", async () => {
      const response = await assignRole(
        new Request("http://localhost/api/admin/users/nonexistent/role", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId: "viewer" })
        }),
        { params: Promise.resolve({ userId: "99999999-0000-0000-0000-000000000099" }) }
      );
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });
  });
});
