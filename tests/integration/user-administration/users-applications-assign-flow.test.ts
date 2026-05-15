import { beforeEach, describe, expect, it } from "vitest";
import { POST as createUser } from "@/app/api/admin/users/route";
import { DELETE as deleteAssignment } from "@/app/api/admin/users/[userId]/applications/[applicationId]/route";
import { GET as listAssignments, POST as assignApplications } from "@/app/api/admin/users/[userId]/applications/route";
import { resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

describe("US3 integration - assignment lifecycle", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
  });

  it("assigns, lists, and removes an application", async () => {
    const createResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "apps_flow_user",
          email: "apps-flow-user@example.com",
          isActive: true
        })
      })
    );

    const createBody = await createResponse.json();
    const userId = createBody.userId as string;
    const applicationId = "10000000-0000-0000-0000-000000000001";

    const assignResponse = await assignApplications(
      new Request("http://localhost/api/admin/users/" + userId + "/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId })
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(assignResponse.status).toBe(201);

    const listResponse = await listAssignments(new Request("http://localhost"), { params: Promise.resolve({ userId }) });
    const listBody = await listResponse.json();
    expect(listBody.applications).toContain(applicationId);

    const deleteResponse = await deleteAssignment(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ userId, applicationId })
    });
    expect(deleteResponse.status).toBe(204);
  });

  it("assigns all active applications and wildcard", async () => {
    const createResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "apps_all_flow_user",
          email: "apps-all-flow-user@example.com",
          isActive: true
        })
      })
    );

    const createBody = await createResponse.json();
    const userId = createBody.userId as string;

    const assignAllResponse = await assignApplications(
      new Request("http://localhost/api/admin/users/" + userId + "/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      }),
      { params: Promise.resolve({ userId }) }
    );

    expect(assignAllResponse.status).toBe(201);

    const listResponse = await listAssignments(new Request("http://localhost"), { params: Promise.resolve({ userId }) });
    const listBody = await listResponse.json();

    expect(listBody.applications).toContain("*");
    expect(listBody.applications).toContain("10000000-0000-0000-0000-000000000001");
  });
});
