import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createUser, GET as listUsers } from "@/app/api/admin/users/route";
import { PUT as assignRole } from "@/app/api/admin/users/[userId]/role/route";
import { POST as assignApplications } from "@/app/api/admin/users/[userId]/applications/route";
import AdminUsersPage from "@/app/admin/users/page";
import { getRuntimeRepositories, resetRuntimeRepositoriesForTests } from "@/infrastructure/persistence/runtime/repositories";

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function measure(operation: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await operation();
  return Date.now() - start;
}

describe("Phase 8 integration - performance", () => {
  beforeEach(() => {
    process.env.USE_INMEMORY_REPOSITORY = "true";
    process.env.DEV_SESSION_USER_ID = "30000000-0000-0000-0000-000000000001";
    resetRuntimeRepositoriesForTests();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  it("keeps user creation p95 below 500ms", async () => {
    const samples: number[] = [];

    for (let i = 0; i < 20; i += 1) {
      const duration = await measure(async () => {
        const response = await createUser(
          new Request("http://localhost/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: `perf_create_${i}`,
              email: `perf-create-${i}@example.com`,
              isActive: true
            })
          })
        );

        expect(response.status).toBe(201);
      });

      samples.push(duration);
    }

    expect(percentile(samples, 95)).toBeLessThan(500);
  });

  it("keeps user list retrieval p95 below 500ms for 1000 users", async () => {
    const repositories = getRuntimeRepositories();

    for (let i = 0; i < 1000; i += 1) {
      await repositories.users.create({
        username: `perf_list_${i}`,
        email: `perf-list-${i}@example.com`,
        isActive: true,
        actorUserId: "30000000-0000-0000-0000-000000000001"
      });
    }

    const samples: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const duration = await measure(async () => {
        const response = await listUsers(new Request("http://localhost/api/admin/users", { method: "GET" }));
        expect(response.status).toBe(200);
      });
      samples.push(duration);
    }

    expect(percentile(samples, 95)).toBeLessThan(500);
  });

  it("keeps role and app assignment p95 below 500ms", async () => {
    const createResponse = await createUser(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "perf_assign_user", email: "perf-assign-user@example.com", isActive: true })
      })
    );
    expect(createResponse.status).toBe(201);
    const userId = (await createResponse.json()).userId as string;

    const samples: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const roleId = i % 2 === 0 ? "viewer" : "application_owner";

      const roleDuration = await measure(async () => {
        const response = await assignRole(
          new Request(`http://localhost/api/admin/users/${userId}/role`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleId })
          }),
          { params: Promise.resolve({ userId }) }
        );
        expect(response.status).toBe(200);
      });
      samples.push(roleDuration);

      const appDuration = await measure(async () => {
        const response = await assignApplications(
          new Request(`http://localhost/api/admin/users/${userId}/applications`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applicationId: "10000000-0000-0000-0000-000000000001" })
          }),
          { params: Promise.resolve({ userId }) }
        );
        expect(response.status).toBe(201);
      });
      samples.push(appDuration);
    }

    expect(percentile(samples, 95)).toBeLessThan(500);
  });

  it("keeps admin tab load below 3 seconds under normal load", async () => {
    const repositories = getRuntimeRepositories();

    for (let i = 0; i < 200; i += 1) {
      await repositories.users.create({
        username: `perf_admin_${i}`,
        email: `perf-admin-${i}@example.com`,
        isActive: true,
        actorUserId: "30000000-0000-0000-0000-000000000001"
      });
    }

    const duration = await measure(async () => {
      const page = await AdminUsersPage();
      expect(page).toBeDefined();
    });

    expect(duration).toBeLessThan(3000);
  });
});
