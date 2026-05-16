import { getContainer } from "@/lib/di/container";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { requireAdministrator } from "@/lib/auth/guards";
import { AppError } from "@/lib/api/error-handler";
import { createServerRequest } from "@/lib/auth/server-request";
import { appBootTrace } from "@/lib/runtime-trace";

export default async function HomePage() {
import { appBootTrace, runWithTraceContext } from "@/lib/runtime-trace";
    const startedAt = Date.now();
    appBootTrace("home:start", { pathname: "/" });
  const request = await createServerRequest("http://internal.local/");
  const requestId = request.headers.get("x-request-id") ?? "unknown";

  return runWithTraceContext({ requestId }, async () => {
    try {
      const startedAt = Date.now();
      appBootTrace("home:start", { pathname: "/", requestId });
      appBootTrace("home:auth:start");
      await requireAdministrator(request, getRuntimeRepositories());
      appBootTrace("home:auth:success", { elapsedMs: Date.now() - startedAt });
    } catch (error: unknown) {
      if (error instanceof AppError && error.status === 401) {
        appBootTrace("home:redirect-login");
        redirect("/login?returnUrl=/");
      }
      if (error instanceof AppError && error.status === 403) {
        appBootTrace("home:redirect-dashboard");
        redirect("/dashboard");
      }

      appBootTrace("home:auth:error", {
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    const container = getContainer();
    appBootTrace("home:data:start");
    const [applications, roles] = await Promise.all([
      container.applicationService.listActiveApplications(),
      container.roleService.listRoles()
    ]);
    appBootTrace("home:data:success", {
      applications: applications.length,
      roles: roles.length
    });
      <div className="page-content-inner">
    return (
      <main className="page-main-content">
        <div className="page-content-inner">
          <h1 className="page-title">Dashboard</h1>
            <span className="stat-card__label">Applications</span>
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
            <span className="stat-card__value">—</span>

          <div className="card">
            <h2 className="card__title">Quick Actions</h2>
            <div className="form-actions">
              <Link href="/admin/users" className="btn btn--primary">User Administration</Link>
            </div>
        <div className="card">
          <div className="form-actions">
          <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--app-text-secondary)' }}>
            Running in <strong>in-memory</strong> mode — no database connection required for local development.
          </p>
        </div>
      </main>
    );
  });
