# Data Model: Dashboard UI and Sub Service Line Grouping (EPIC-BQM-014)

**Feature Branch**: `010-dashboard-ui-grouping`  
**Date**: 2026-05-07  
**Spec**: [spec.md](spec.md)

## Overview

This feature introduces dashboard presentation-focused entities and view models for grouping and state handling. It consumes existing persisted metric snapshots and pipeline run state from prior epics; no new metric calculation storage entities are introduced in EPIC-BQM-014.

## 1. Existing Source Entities (Consumed)

### 1.1 MetricSnapshotViewSource
**Source**: Existing metrics retrieval path over `app.MetricSnapshots` (+ related run/application metadata)

**Purpose**: Provides immutable KPI values for dashboard cards and grouped detail rows.

**Required fields consumed by this epic**:
- `applicationId`
- `applicationName`
- `runId`
- `calculationDate`
- `refreshTimestamp`
- `metricDefinitionVersion`
- `denominatorCount`
- `numeratorCount`
- `matchedCount`
- `adoptionPct`
- `denominatorRevenue`
- `numeratorRevenue`
- `revenuePct`
- `avgEngagement`

### 1.2 PipelineRunStatusSource
**Source**: Existing pipeline run status retrieval (`app.PipelineRuns` through existing API/service contracts)

**Purpose**: Provides lifecycle status for in-progress and freshness indicators.

**Required fields consumed by this epic**:
- `runId`
- `applicationId`
- `status`
- `startTime`
- `endTime`

### 1.3 ApplicationScopeSource
**Source**: Existing identity/authorization scope (`app.Users`, `app.Roles`, `app.UserApplications` via session/auth service)

**Purpose**: Limits visible applications and rollups to authorized scope.

**Required fields consumed by this epic**:
- `userId`
- `role`
- `assignedApplicationIds`

## 2. New Presentation Entities (Feature-Level)

### 2.1 DashboardScope
Represents an authorized request scope for dashboard retrieval and grouping.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | string (UUID/identity key) | Yes | Authenticated principal |
| `role` | enum(`administrator`,`application_owner`,`viewer`) | Yes | Role used for authorization behavior |
| `applicationIds` | string[] | Yes | Applications visible for this request |
| `selectedSubServiceLine` | string \| null | Yes | Optional filter value, null means all |

**Validation rules**:
- `role` must be one of allowed role values.
- Non-admin users must have `applicationIds` subset from assignments.
- `selectedSubServiceLine` must match available values for the scoped dataset when provided.

### 2.2 DashboardKpiCardSet
Represents KPI cards shown in the dashboard KPI row.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `investment` | MetricCardValue | Yes | Investment KPI with authority label |
| `revenue` | MetricCardValue | Yes | Revenue KPI |
| `averageEngagement` | MetricCardValue | Yes | Avg engagement KPI (nullable value allowed) |
| `onTargetRate` | MetricCardValue | Yes | On-target KPI |
| `refreshTimestamp` | string (ISO datetime) | Yes | Snapshot freshness indicator |

`MetricCardValue`:
- `value`: number \| null
- `label`: string
- `basis`: string \| null
- `isNonAuthoritative`: boolean

### 2.3 DashboardGroup
Represents grouped hierarchy nodes for detail panel rendering.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `groupType` | enum(`portfolio`,`subServiceLine`,`application`) | Yes | Hierarchy level |
| `groupKey` | string | Yes | Stable key for rendering/interaction |
| `displayName` | string | Yes | User-visible label |
| `subServiceLine` | string \| null | Yes | Group category context |
| `metrics` | GroupMetricSummary | Yes | Rollup or row-level metrics |
| `children` | DashboardGroup[] | Yes | Nested groups for hierarchy |

`GroupMetricSummary`:
- `denominatorCount`: number
- `numeratorCount`: number
- `matchedCount`: number
- `adoptionPct`: number
- `revenuePct`: number
- `denominatorRevenue`: number \| null
- `numeratorRevenue`: number \| null
- `status`: enum(`On Target`,`Below Target`,`Unknown`)

### 2.4 DashboardStateIndicator
Represents UI state context for top-level rendering behavior.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `state` | enum(`ready`,`empty`,`inProgress`,`error`) | Yes | Dashboard state |
| `message` | string | Yes | User-friendly non-technical message |
| `lastSuccessfulRunId` | string \| null | Yes | Latest completed run reference |
| `isRecalculating` | boolean | Yes | Indicates active processing with prior snapshot |

**State transition rules**:
- `empty`: when no completed snapshots exist for scope.
- `inProgress`: when active run exists and prior completed snapshot is available.
- `error`: when retrieval fails or scoped data cannot be loaded safely.
- `ready`: when scoped snapshot data is available and no blocking errors exist.

## 3. Entity Relationships

```text
DashboardScope
  -> filters ApplicationScopeSource
  -> requests MetricSnapshotViewSource + PipelineRunStatusSource
  -> produces DashboardKpiCardSet
  -> produces DashboardGroup hierarchy
  -> determines DashboardStateIndicator
```

## 4. Invariants and Constraints

- All displayed data must be scoped to authorized applications before grouping.
- Group hierarchy must preserve portfolio -> Sub Service Line -> application ordering.
- Dashboard rendering must not mutate or recalculate persisted KPI values.
- Empty/inProgress/error states must preserve section layout contract.
- Status chip values must be deterministic from adoption threshold policy.
