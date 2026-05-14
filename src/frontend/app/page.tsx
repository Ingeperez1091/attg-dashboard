import { getContainer } from "@/lib/di/container";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { requireAdministrator } from "@/lib/auth/guards";
import { AppError } from "@/lib/api/error-handler";
import { createServerRequest } from "@/lib/auth/server-request";

export default async function HomePage() {
  try {
    await requireAdministrator(await createServerRequest("http://internal.local/"), getRuntimeRepositories());
  } catch (error: unknown) {
    if (error instanceof AppError && error.status === 401) {
      redirect("/login?returnUrl=/");
    }
    if (error instanceof AppError && error.status === 403) {
      redirect("/dashboard");
    }

    throw error;
  }

  const container = getContainer();
  const [applications, roles] = await Promise.all([
    container.applicationService.listActiveApplications(),
    container.roleService.listRoles()
  ]);

  return (
    <main className="page-main-content">
      <div className="page-content-inner">
        <h1 className="page-title">Dashboard</h1>

        <div className="card-grid">
          <div className="stat-card">
            <span className="stat-card__label">Applications</span>
            <span className="stat-card__value">{applications.length}</span>
            <span className="stat-card__sub">{applications.map((a: any) => a.applicationName).join(" · ")}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Users</span>
            <span className="stat-card__value">—</span>
            <span className="stat-card__sub">Manage in User Administration</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Roles</span>
            <span className="stat-card__value">{roles.length}</span>
            <span className="stat-card__sub">{roles.map((r: any) => r.roleName).join(" · ")}</span>
          </div>
        </div>

        <div className="card">
          <h2 className="card__title">Quick Actions</h2>
          <div className="form-actions">
            <Link href="/admin/users" className="btn btn--primary">User Administration</Link>
          </div>
        </div>

        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--app-text-secondary)' }}>
          Running in <strong>in-memory</strong> mode — no database connection required for local development.
        </p>
      </div>
    </main>
  );
}
