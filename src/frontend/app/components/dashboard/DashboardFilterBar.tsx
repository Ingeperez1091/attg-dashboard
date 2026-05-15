"use client";

import { KeyboardEvent, useRef } from "react";
import {
  resolveDashboardFilterNavigation,
  toDashboardFilterTabId
} from "@/app/components/dashboard/dashboardAccessibility";

interface DashboardFilterBarProps {
  filters: string[];
  selectedFilter: string;
  onFilterChange: (filter: string) => void | Promise<void>;
  disabled?: boolean;
}

export function DashboardFilterBar({
  filters,
  selectedFilter,
  onFilterChange,
  disabled = false
}: DashboardFilterBarProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  async function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, filter: string): Promise<void> {
    const nextFilter = resolveDashboardFilterNavigation(filters, filter, event.key);
    if (!nextFilter) {
      return;
    }

    event.preventDefault();
    await onFilterChange(nextFilter);

    const nextIndex = filters.indexOf(nextFilter);
    if (nextIndex >= 0) {
      buttonRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <section className="dashboard-filter-bar" aria-label="Dashboard filters">
      <span className="dashboard-filter-bar__label">Sub Service Line</span>
      <div className="dashboard-filter-bar__tabs" role="tablist" aria-label="Sub service line selector">
        {filters.map((filter, index) => {
          const active = filter === selectedFilter;
          return (
            <button
              key={filter}
              id={toDashboardFilterTabId(filter)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="dashboard-detail-panel"
              tabIndex={active ? 0 : -1}
              className={`dashboard-filter-bar__tab${active ? " is-active" : ""}`}
              onClick={() => onFilterChange(filter)}
              onKeyDown={(event) => void handleKeyDown(event, filter)}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              disabled={disabled}
            >
              {filter}
            </button>
          );
        })}
      </div>
    </section>
  );
}