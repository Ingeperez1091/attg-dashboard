"use client";

import { ReactElement } from "react";
import { ApplicationPickerOptionDto } from "@/core/application/dto/applications/ApplicationOptionDto";

interface ApplicationPickerProps {
  applications: ApplicationPickerOptionDto[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

/**
 * Multi-select checkbox grid for assigning application access to a user.
 * Renders each application as a clickable tile with a checkbox.
 */
export function ApplicationPicker({
  applications,
  selected,
  onChange,
  disabled,
}: ApplicationPickerProps): ReactElement {
  const allApplicationIds = applications.map((app) => app.applicationId);
  const allSelected = allApplicationIds.length > 0 && allApplicationIds.every((id) => selected.includes(id));

  function toggle(id: string): void {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  function toggleAll(): void {
    onChange(allSelected ? [] : allApplicationIds);
  }

  if (applications.length === 0) {
    return (
      <p className="picker-empty">No applications available.</p>
    );
  }

  return (
    <div role="group" aria-label="Select applications">
      <label
        className={`picker-item picker-item--all${allSelected ? " picker-item--selected" : ""}${disabled ? " picker-item--disabled" : ""}`}
      >
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          disabled={disabled}
          value="*"
        />
        <span className="picker-item__name">Select all applications</span>
      </label>

      <div className="picker-grid">
        {applications.map((app) => {
          const checked = selected.includes(app.applicationId);
          return (
            <label
              key={app.applicationId}
              className={`picker-item${checked ? " picker-item--selected" : ""}${disabled ? " picker-item--disabled" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(app.applicationId)}
                disabled={disabled}
                value={app.applicationId}
              />
              <span className="picker-item__name">{app.name}</span>
              {app.description ? (
                <span className="picker-item__desc sr-only">{app.description}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
