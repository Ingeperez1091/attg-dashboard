import { ReactElement, ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/api/error-handler";
import { requireActive } from "@/lib/auth/guards";
import { createServerRequest } from "@/lib/auth/server-request";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";

export default async function FiltersLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  try {
    const session = await requireActive(
      await createServerRequest("http://internal.local/filters"),
      getRuntimeRepositories()
    );

    if (session.role === "viewer") {
      redirect("/dashboard");
    }
  } catch (error: unknown) {
    if (error instanceof AppError && error.status === 401) {
      redirect("/login?returnUrl=/filters");
    }
    if (error instanceof AppError && error.status === 403) {
      redirect("/dashboard");
    }

    throw error;
  }

  return <>{children}</>;
}