"use client";

import { useEffect, useState } from "react";
import { DashboardUsageResponseDto } from "@/core/application/dto/dashboardUsageDto";
import { DashboardDetailPanel } from "@/app/components/dashboard/DashboardDetailPanel";
import { DashboardFilterBar } from "@/app/components/dashboard/DashboardFilterBar";
import { DashboardFooterLegend } from "@/app/components/dashboard/DashboardFooterLegend";
import { DashboardHero } from "@/app/components/dashboard/DashboardHero";
import { DashboardKpiRow } from "@/app/components/dashboard/DashboardKpiRow";
import { DashboardStateShell } from "@/app/components/dashboard/DashboardStateShell";

const ALL_FILTER = "All";

function toFilterOptions(response: DashboardUsageResponseDto | null): string[] {
  if (!response) {
    return [ALL_FILTER];
  }

  return [
    ALL_FILTER,
    ...response.groups.map((group) => group.displayName)
  ];
}

async function fetchDashboardUsage(subServiceLine?: string): Promise<DashboardUsageResponseDto> {
  const url = new URL("/api/dashboard/usage", window.location.origin);
  if (subServiceLine && subServiceLine !== ALL_FILTER) {
    url.searchParams.set("subServiceLine", subServiceLine);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store"
  });
  const body = await response.json();

  if (!response.ok && body?.state?.state) {
    return body as DashboardUsageResponseDto;
  }

  if (!response.ok) {
    throw new Error(body?.message ?? "Unable to load dashboard data.");
  }

  return body as DashboardUsageResponseDto;
}

export function DashboardClient() {
  const [selectedFilter, setSelectedFilter] = useState(ALL_FILTER);
  const [responsesByFilter, setResponsesByFilter] = useState<Record<string, DashboardUsageResponseDto>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadInitial(): Promise<void> {
      try {
        const response = await fetchDashboardUsage();
        if (!mounted) {
          return;
        }

        setResponsesByFilter({ [ALL_FILTER]: response });
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Unable to load dashboard data.";
        setResponsesByFilter({
          [ALL_FILTER]: {
            scope: {
              userId: "unknown",
              role: "viewer",
              applicationIds: [],
              selectedSubServiceLine: null
            },
            hero: {
              title: "Application Usage Dashboard",
              latestRunId: null,
              refreshTimestamp: null
            },
            kpis: null,
            groups: [],
            state: {
              state: "error",
              message,
              lastSuccessfulRunId: null,
              isRecalculating: false
            },
            legend: {
              metricDefinitionVersion: null
            }
          }
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleFilterChange(nextFilter: string): Promise<void> {
    setSelectedFilter(nextFilter);

    if (responsesByFilter[nextFilter] || nextFilter === ALL_FILTER) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetchDashboardUsage(nextFilter);
      setResponsesByFilter((current) => ({ ...current, [nextFilter]: response }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load dashboard data.";
      setResponsesByFilter((current) => ({
        ...current,
        [nextFilter]: {
          scope: current[ALL_FILTER]?.scope ?? {
            userId: "unknown",
            role: "viewer",
            applicationIds: [],
            selectedSubServiceLine: nextFilter === ALL_FILTER ? null : nextFilter
          },
          hero: current[ALL_FILTER]?.hero ?? {
            title: "Application Usage Dashboard",
            latestRunId: null,
            refreshTimestamp: null
          },
          kpis: null,
          groups: [],
          state: {
            state: "error",
            message,
            lastSuccessfulRunId: null,
            isRecalculating: false
          },
          legend: current[ALL_FILTER]?.legend ?? {
            metricDefinitionVersion: null
          }
        }
      }));
    } finally {
      setLoading(false);
    }
  }

  const currentResponse = responsesByFilter[selectedFilter] ?? responsesByFilter[ALL_FILTER] ?? null;
  const filterOptions = toFilterOptions(responsesByFilter[ALL_FILTER] ?? null);

  return (
    <main className="dashboard-page">
      <div className="dashboard-page__inner">
        <DashboardHero
          latestRunId={currentResponse?.hero.latestRunId ?? null}
          refreshTimestamp={currentResponse?.hero.refreshTimestamp ?? null}
          loading={loading && !currentResponse}
        />

        <DashboardKpiRow kpis={currentResponse?.kpis ?? null} loading={loading && !currentResponse} />

        <DashboardFilterBar
          filters={filterOptions}
          selectedFilter={selectedFilter}
          onFilterChange={handleFilterChange}
          disabled={loading && !currentResponse}
        />

        <DashboardStateShell state={currentResponse?.state ?? null} loading={loading && !currentResponse}>
          <DashboardDetailPanel
            activeFilter={selectedFilter}
            groups={currentResponse?.groups ?? []}
            state={currentResponse?.state ?? null}
            loading={loading && !currentResponse}
          />

          <DashboardFooterLegend
            legend={currentResponse?.legend ?? null}
            refreshTimestamp={currentResponse?.hero.refreshTimestamp ?? null}
          />
        </DashboardStateShell>
      </div>
    </main>
  );
}