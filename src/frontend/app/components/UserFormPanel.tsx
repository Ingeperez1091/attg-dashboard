"use client";

import { ReactElement, useState } from "react";
import { Role, RoleName } from "@/core/domain/entities/Role";
import { AdminUserDto } from "@/core/application/dto/admin/AdminUserDto";
import { ApplicationPickerOptionDto } from "@/core/application/dto/applications/ApplicationOptionDto";
import { RolePicker } from "./RolePicker";
import { ApplicationPicker } from "./ApplicationPicker";
import { ValidationSummary } from "./ValidationSummary";
import { Spinner } from "./Spinner";
import { useUserAuditMetadata } from "./hooks/useUserAuditMetadata";

interface UserFormPanelProps {
  mode: "create" | "edit";
  /** When mode is "edit", the current user data to pre-fill */
  user?: AdminUserDto;
  userDirectory?: AdminUserDto[];
  availableApplications: ApplicationPickerOptionDto[];
  availableRoles: Role[];
  onClose: () => void;
  /** Called with the created/updated userId on success */
  onSuccess?: (userId: string) => void;
}

function validateFields(fields: {
  username: string;
  email: string;
  displayName: string;
}): string[] {
  const errs: string[] = [];
  if (!fields.username.trim()) errs.push("Username is required.");
  if (!fields.email.trim()) errs.push("Email address is required.");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errs.push("Email must be a valid address.");
  if (fields.username.length > 100) errs.push("Username must be 100 characters or fewer.");
  if (fields.email.length > 320) errs.push("Email must be 320 characters or fewer.");
  if (fields.displayName.length > 200) errs.push("Display name must be 200 characters or fewer.");
  return errs;
}

/**
 * Slide-in drawer panel for creating or editing a user.
 * Composes RolePicker, ApplicationPicker, and ValidationSummary.
 *
 * Usage:
 *   <UserFormPanel mode="create" availableApplications={apps} onClose={() => setOpen(false)} onSuccess={reload} />
 *   <UserFormPanel mode="edit" user={user} availableApplications={apps} onClose={...} onSuccess={reload} />
 */
export function UserFormPanel({
  mode,
  user,
  userDirectory = [],
  availableApplications,
  availableRoles,
  onClose,
  onSuccess,
}: UserFormPanelProps): ReactElement {
  const [username, setUsername] = useState(user ? user.email.split("@")[0] : "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [role, setRole] = useState<RoleName>(user?.role ?? "viewer");
  const [selectedApps, setSelectedApps] = useState<string[]>(user?.applications ?? []);
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const auditMetadata = useUserAuditMetadata(user, userDirectory);

  const allErrors = serverError ? [...fieldErrors, serverError] : fieldErrors;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    const errs = validateFields({ username, email, displayName });
    if (errs.length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors([]);
    setServerError(null);
    setSubmitting(true);

    try {
      if (mode === "create") {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            email,
            displayName: displayName || undefined,
            isActive,
            roleId: role,
            applicationIds: selectedApps
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setServerError(body.message ?? "Failed to create user.");
          return;
        }

        const created = (await res.json()) as { userId: string };

        onSuccess?.(created.userId);
        onClose();
      } else if (mode === "edit" && user) {
        const res = await fetch(`/api/admin/users/${user.userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleId: role,
            isActive,
            applicationIds: selectedApps
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setServerError(body.message ?? "Failed to update user.");
          return;
        }

        onSuccess?.(user.userId);
        onClose();
      }
    } catch {
      setServerError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "create" ? "Add User" : "Edit User";

  return (
    <div className="user-form-overlay" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop — click to close */}
      <div className="user-form-backdrop" onClick={onClose} aria-hidden="true" />

      <aside className="user-form-drawer">
        {/* Header */}
        <div className="user-form-header">
          <h2 className="user-form-title">{title}</h2>
          <button
            type="button"
            className="user-form-close"
            aria-label="Close panel"
            onClick={onClose}
            disabled={submitting}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form className="user-form-body" onSubmit={handleSubmit} noValidate>
          <ValidationSummary errors={allErrors} />

          {/* Identity fields */}
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="ufp-username">Username</label>
              <input
                id="ufp-username"
                name="username"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. john_doe"
                disabled={mode === "edit" || submitting}
                required
                autoComplete="off"
              />
            </div>
            <div className="form-field">
              <label htmlFor="ufp-email">Email address</label>
              <input
                id="ufp-email"
                name="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={mode === "edit" || submitting}
                required
              />
            </div>
            <div className="form-field user-form-wide">
              <label htmlFor="ufp-displayName">Display name</label>
              <input
                id="ufp-displayName"
                name="displayName"
                className="form-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Full name (optional)"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Role */}
          <div className="form-field">
            <label htmlFor="ufp-role" className="user-form-section-label">
              Role
            </label>
            <RolePicker
              id="ufp-role"
              name="role"
              value={role}
              onChange={setRole}
              roles={availableRoles}
              disabled={submitting}
            />
          </div>

          {/* Active toggle */}
          <label className="user-form-active-row">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={submitting}
            />
            <span>Active</span>
          </label>

          {/* Applications */}
          {availableApplications.length > 0 && (
            <div className="form-field">
              <p className="user-form-section-label">Application access</p>
              <ApplicationPicker
                applications={availableApplications}
                selected={selectedApps}
                onChange={setSelectedApps}
                disabled={submitting}
              />
            </div>
          )}

          {mode === "edit" && user && (
            <section className="user-form-audit user-form-audit--bottom" aria-label="User audit details">
              <h3 className="user-form-audit__title">Last update details</h3>
              <p className="user-form-audit__line">
                Updated by <strong>{auditMetadata.updatedByName}</strong> on {auditMetadata.updatedAtLabel}
              </p>
              <p className="user-form-audit__line">
                Created by <strong>{auditMetadata.createdByName}</strong>
              </p>
            </section>
          )}

          {/* Footer */}
          <div className="user-form-footer">
            {submitting ? (
              <Spinner size="sm" label="Saving…" inline />
            ) : (
              <>
                <button type="submit" className="btn btn--primary">
                  {mode === "create" ? "Create user" : "Save changes"}
                </button>
                <button type="button" className="btn btn--outline" onClick={onClose}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}
