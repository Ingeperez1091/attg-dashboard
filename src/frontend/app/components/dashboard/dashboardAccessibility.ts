export function toDashboardFilterTabId(filter: string): string {
  const normalized = filter.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `dashboard-filter-tab-${normalized || "all"}`;
}

export function resolveDashboardFilterNavigation(filters: string[], selectedFilter: string, key: string): string | null {
  const currentIndex = Math.max(filters.indexOf(selectedFilter), 0);

  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return filters[(currentIndex + 1) % filters.length] ?? null;
    case "ArrowLeft":
    case "ArrowUp":
      return filters[(currentIndex - 1 + filters.length) % filters.length] ?? null;
    case "Home":
      return filters[0] ?? null;
    case "End":
      return filters[filters.length - 1] ?? null;
    default:
      return null;
  }
}