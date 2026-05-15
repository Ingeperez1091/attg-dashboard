"use client";

import { ReactElement } from "react";
import { RoleName } from "@/core/domain/entities/Role";
import { AdminUserDto } from "@/core/application/dto/admin/AdminUserDto";
import { Spinner } from "./Spinner";

const ROLE_LABEL: Record<RoleName, string> = {
  administrator: "Administrator",
  application_owner: "App Owner",
  viewer: "Viewer",
};

const ROLE_BADGE: Record<RoleName, string> = {
  administrator: "badge badge--admin",
  application_owner: "badge badge--owner",
  viewer: "badge badge--viewer",
};

interface UserListTableProps {
  users: AdminUserDto[];
  currentUserRole: RoleName;
  loading?: boolean;
  /** Called when the "Edit" action is clicked for a row */
  onEditUser?: (userId: string) => void;
  /** Called when the active toggle button is clicked */
  onToggleActive?: (userId: string, newIsActive: boolean) => void;
}

/**
 * Reusable data table for listing admin users.
 * Shows a spinner while loading, and an empty-state message when there are no users.
 * Action buttons are only shown for administrators.
 */
export function UserListTable({
  users,
  currentUserRole,
  loading,
  onEditUser,
  onToggleActive,
}: UserListTableProps): ReactElement {
  const canAct = currentUserRole === "administrator";
  const activeAdministratorCount = users.filter(
    (candidate) => candidate.isActive && candidate.role === "administrator"
  ).length;

  if (loading) {
    return <Spinner label="Loading users…" />;
  }

  if (users.length === 0) {
    return (
      <p className="table-empty">No users found. Use the form to add the first user.</p>
    );
  }

  return (
    <table className="data-table app-data-table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Display Name</th>
          <th>Role</th>
          <th>Apps</th>
          <th>Status</th>
          {canAct && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.userId}>
            <td>{user.email}</td>
            <td className={user.displayName ? undefined : "app-cell-muted"}>
              {user.displayName ?? "—"}
            </td>
            <td>
              <span className={ROLE_BADGE[user.role]}>{ROLE_LABEL[user.role]}</span>
            </td>
            <td className="app-cell-meta">
              {user.applications.length === 0
                ? "—"
                : user.applications.length === 1
                  ? "1 app"
                  : `${user.applications.length} apps`}
            </td>
            <td>
              <span className={user.isActive ? "badge badge--active" : "badge badge--inactive"}>
                {user.isActive ? "Active" : "Inactive"}
              </span>
            </td>
            {canAct && (
              <td>
                <div className="actions-cell">
                  {onEditUser && (
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => onEditUser(user.userId)}
                    >
                      Edit
                    </button>
                  )}
                  {onToggleActive && (
                    <button
                      type="button"
                      className={user.isActive ? "btn btn--destructive btn--sm" : "btn btn--outline btn--sm"}
                      disabled={
                        user.isActive &&
                        user.role === "administrator" &&
                        activeAdministratorCount <= 1
                      }
                      title={
                        user.isActive &&
                        user.role === "administrator" &&
                        activeAdministratorCount <= 1
                          ? "At least one active administrator is required."
                          : undefined
                      }
                      onClick={() => onToggleActive(user.userId, !user.isActive)}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
