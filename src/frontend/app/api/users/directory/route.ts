import { requireActive } from "@/lib/auth/guards";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { getContainer } from "@/lib/di/container";

/**
 * GET /api/users/directory
 * Returns a minimal user directory (userId, displayName, email) for display-name resolution.
 * Accessible to any authenticated active session (administrator or application_owner).
 */
export async function GET(request: Request): Promise<Response> {
  await requireActive(request, getRuntimeRepositories());

  const users = await getContainer().userService.listUsers(false);

  const directory = users.map((u) => ({
    userId: u.userId,
    displayName: u.displayName,
    email: u.email,
  }));

  return Response.json({ users: directory }, { status: 200 });
}
