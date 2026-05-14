import { getContainer } from "@/lib/di/container";

export async function GET(): Promise<Response> {
  const roles = await getContainer().roleService.listRoles();
  return Response.json({ roles }, { status: 200 });
}
