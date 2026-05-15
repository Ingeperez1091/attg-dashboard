import { getContainer } from "@/lib/di/container";

export async function GET(): Promise<Response> {
  const applications = await getContainer().applicationService.listActiveApplications();
  return Response.json({ applications }, { status: 200 });
}
