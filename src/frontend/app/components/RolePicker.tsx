"use client";

import { ReactElement, useMemo } from "react";
import { Role } from "@/core/domain/entities/Role";
import { RoleName } from "@/core/domain/entities/Role";

interface RolePickerProps {
  id?: string;
  name?: string;
  value: RoleName;
  onChange: (role: RoleName) => void;
  disabled?: boolean;
  required?: boolean;
  roles: Role[];
  /** Show descriptions alongside each option (rendered as a list of radio tiles instead of a select) */
  tileMode?: boolean;
}

/**
 * Select (or radio-tile) for picking a single user role.
 * Default renders a native <select> using `.form-input`.
 * Pass `tileMode` to render interactive labelled radio tiles.
 */
export function RolePicker({
  id,
  name,
  value,
  onChange,
  disabled,
  required,
  roles,
  tileMode,
}: RolePickerProps): ReactElement {
  const uniqueRoles = useMemo(() => {
    const seen = new Set<RoleName>();
    return roles.filter((role) => {
      if (seen.has(role.roleId)) {
        return false;
      }

      seen.add(role.roleId);
      return true;
    });
  }, [roles]);

  if (tileMode) {
    return (
      <div className="role-picker-tiles" role="radiogroup" aria-required={required}>
        {uniqueRoles.map((role) => (
          <label
            key={role.roleId}
            className={`role-tile${value === role.roleId ? " role-tile--selected" : ""}${disabled ? " role-tile--disabled" : ""}`}
          >
            <input
              type="radio"
              name={name ?? "role"}
              value={role.roleId}
              checked={value === role.roleId}
              onChange={() => onChange(role.roleId)}
              disabled={disabled}
              required={required}
              className="sr-only"
            />
            <span className="role-tile__label">{role.roleName}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value as RoleName)}
      disabled={disabled}
      required={required}
      className="form-input"
      style={{ width: "100%" }}
    >
      {uniqueRoles.map((role) => (
        <option key={role.roleId} value={role.roleId}>
          {role.roleName}
        </option>
      ))}
    </select>
  );
}
