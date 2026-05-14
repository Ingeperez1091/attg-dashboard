"use client";

import { ReactElement, useMemo, useState } from "react";
import { UserFormPanel } from "@/app/components/UserFormPanel";
import { UserListTable } from "@/app/components/UserListTable";
import { ValidationSummary } from "@/app/components/ValidationSummary";
import { Role, RoleName } from "@/core/domain/entities/Role";
import { AdminUserDto } from "@/core/application/dto/admin/AdminUserDto";
import { ApplicationPickerOptionDto } from "@/core/application/dto/applications/ApplicationOptionDto";

interface UsersPageClientProps {
  initialUsers: AdminUserDto[];
  availableApplications: ApplicationPickerOptionDto[];
  availableRoles: Role[];
  currentUserRole: RoleName;
}

type FormMode = "create" | "edit";

export function UsersPageClient({
  initialUsers,
  availableApplications,
  availableRoles,
  currentUserRole,
}: UsersPageClientProps): ReactElement {
  const [users, setUsers] = useState<AdminUserDto[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleUsers = useMemo(
    () =>
      users.filter((u) => {
        if (!includeInactive && !u.isActive) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          u.email.toLowerCase().includes(normalizedSearch) ||
          (u.displayName ?? "").toLowerCase().includes(normalizedSearch)
        );
      }),
    [users, includeInactive, normalizedSearch]
  );

  const editingUser = useMemo(
    () => users.find((u) => u.userId === editingUserId),
    [users, editingUserId]
  );

  function openCreate(): void {
    setErrors([]);
    setFormMode("create");
    setEditingUserId(null);
    setFormOpen(true);
  }

  function openEdit(userId: string): void {
    setErrors([]);
    setFormMode("edit");
    setEditingUserId(userId);
    setFormOpen(true);
  }

  function closeForm(): void {
    setFormOpen(false);
  }

  function handleSaved(_userId: string): void {
    // Refresh to pick up canonical state after create/edit API calls.
    window.location.reload();
  }

  async function handleToggleActive(userId: string, newIsActive: boolean): Promise<void> {
    setErrors([]);
    setTableLoading(true);

    try {
      const targetUser = users.find((candidate) => candidate.userId === userId);

      if (!targetUser) {
        setErrors(["User not found in the current table state."]);
        return;
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: targetUser.role,
          isActive: newIsActive,
          applicationIds: targetUser.applications
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setErrors([body.message ?? "Failed to update user active status."]);
        return;
      }

      setUsers((current) =>
        current.map((u) => (u.userId === userId ? { ...u, isActive: newIsActive } : u))
      );
    } catch {
      setErrors(["An unexpected error occurred while updating user status."]);
    } finally {
      setTableLoading(false);
    }
  }

  return (
    <main className="app-surface-shell">
      <div className="section-header app-surface-header">
        <h1 className="page-title app-surface-title">User Administration</h1>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          Add user
        </button>
      </div>

      <ValidationSummary errors={errors} title="Could not complete action:" />

      <section className="card app-surface-card">
        <div className="section-header">
          <h2 className="section-header__title app-surface-section-title">Users</h2>
          <span className="app-surface-count">
            {visibleUsers.length} {visibleUsers.length === 1 ? "user" : "users"}
          </span>
        </div>

        <div className="app-surface-filters">
          <input
            type="search"
            className="form-input app-surface-search"
            placeholder="Search users by email or display name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div
            role="group"
            aria-label="User status filter"
            className="app-segmented"
          >
            <button
              type="button"
              className={`btn btn--sm app-segmented__button${!includeInactive ? " is-active" : ""}`}
              onClick={() => setIncludeInactive(false)}
              aria-pressed={!includeInactive}
            >
              Active
            </button>
            <button
              type="button"
              className={`btn btn--sm app-segmented__button${includeInactive ? " is-active" : ""}`}
              onClick={() => setIncludeInactive(true)}
              aria-pressed={includeInactive}
            >
              All
            </button>
          </div>
        </div>

        <UserListTable
          users={visibleUsers}
          currentUserRole={currentUserRole}
          loading={tableLoading}
          onEditUser={openEdit}
          onToggleActive={handleToggleActive}
        />
      </section>

      {formOpen && (
        <UserFormPanel
          mode={formMode}
          user={formMode === "edit" ? editingUser : undefined}
          userDirectory={users}
          availableApplications={availableApplications}
          availableRoles={availableRoles}
          onClose={closeForm}
          onSuccess={handleSaved}
        />
      )}
    </main>
  );
}
