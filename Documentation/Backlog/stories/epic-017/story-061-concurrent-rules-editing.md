# BQM-US061 — Concurrent Rules Editing with Optimistic Concurrency and Conflict Resolution

> **Azure DevOps Work Item Type**: User Story  
> **ADO ID**: _TBD_  
> **Epic Parent**: EPIC-BQM-017 (Impact Preview & Numerator Composite-Key Deduplication)  
> **Priority**: 1 — Critical | **Phase**: Phase 2  
> **Changelog**: v1.0.0 — Initial story; concurrency control mechanism for rules configuration (denominator and numerator).

---

### :bust_in_silhouette: User Story

**As an** application owner  
**I want** the system to detect and resolve conflicts when another user edits the same application's rules simultaneously  
**So that** my changes are never silently overwritten, I am warned when someone else is editing, and I can resolve conflicts without losing my work.

### :white_check_mark: Acceptance Criteria (Given/When/Then)

#### Optimistic Concurrency
- **Given** I load denominator rules for Application X at `ConfigVersion = 5`, and another user saves new rules (version becomes 6), **When** I click "Save Configuration" with my version 5 payload, **Then** the server rejects my request with HTTP 409 Conflict and returns the current state (version 6, rules, last modifier).
- **Given** I load rules at `ConfigVersion = 5` and no one else has saved, **When** I click "Save Configuration", **Then** the save succeeds, `ConfigVersion` increments to 6, and my rules are persisted.
- **Given** the server returns 409, **When** the UI processes the response, **Then** my unsaved form state is preserved — no data is lost.

#### Advisory Edit Session (Soft Lock)
- **Given** User A opens the rules form for Application X in edit mode, **When** User B opens the same application's rules form, **Then** User B sees a warning banner: "⚠️ [User A] is currently editing this configuration (started at HH:MM). Your changes may conflict."
- **Given** User A closes the rules form (or navigates away), **When** the session is released, **Then** User B's warning banner disappears on the next poll cycle (≤ 15 seconds).
- **Given** User A's browser crashes without releasing the session, **When** 5 minutes pass without a heartbeat, **Then** the stale session is automatically cleaned up and no longer shown to other users.
- **Given** I am a `viewer` (read-only), **When** I open the rules form, **Then** no edit session is registered and no warning is shown to other users.

#### Conflict Resolution UX
- **Given** I receive a 409 Conflict, **When** the conflict dialog opens, **Then** I see: (a) "Your changes" summary, (b) "Latest saved version" summary with who saved it and when, (c) a visual diff of rules that changed.
- **Given** I choose "Reload & re-edit", **When** applied, **Then** the form loads the latest saved version (version 6) and I can re-apply my changes manually.
- **Given** I choose "Force-save" and I am an `administrator`, **When** applied, **Then** my version is saved as version 7, overriding the intermediate save, and an audit log entry records the force-override with reason.
- **Given** I choose "Force-save" and I am an `application_owner` (not administrator), **Then** the "Force-save" option is not available (hidden or disabled).
- **Given** I choose "Cancel", **When** applied, **Then** the conflict dialog closes and my form returns to its pre-save state (unsaved changes still in the form).

#### Notifications
- **Given** I am actively editing rules and another user saves a new version, **When** my next poll cycle occurs (≤ 15 seconds), **Then** I see an inline notification: "Configuration was updated by [User Y] at HH:MM. Your save may result in a conflict."

### :hammer_and_wrench: Technical Tasks

- [ ] [BQM-TK220] **Database Migration**: Add `ConfigVersion INT NOT NULL DEFAULT 1` column to `app.DenominatorFilterRules` (logically per-ApplicationId — implemented as a separate `app.ConfigVersions` table with `ApplicationId`, `RuleScope`, `Version`, `LastModifiedBy`, `LastModifiedAt`).
- [ ] [BQM-TK221] **Database Migration**: Create `app.ConfigEditSessions` table (SessionId UNIQUEIDENTIFIER PK, ApplicationId, RuleScope NVARCHAR(32), UserId NVARCHAR(128), SessionStart DATETIME2, LastHeartbeat DATETIME2, IsActive BIT).
- [ ] [BQM-TK222] **API: Version enforcement** — Modify `PUT /api/filters/denominator/:appId` and `PUT /api/filters/numerator/:appId` to require `configVersion` in request body (or `If-Match` header). On version mismatch: return 409 with `{ currentVersion, currentRules, lastModifiedBy, lastModifiedAt }`.
- [ ] [BQM-TK223] **API: Edit session lifecycle** — Implement `POST /api/filters/:scope/:appId/edit-session` (register), `PATCH /api/filters/:scope/:appId/edit-session` (heartbeat), `DELETE /api/filters/:scope/:appId/edit-session` (release).
- [ ] [BQM-TK224] **API: Active editors** — Extend `GET /api/filters/denominator/:appId` and `GET /api/filters/numerator/:appId` responses to include `configVersion` and `activeEditors[]` array.
- [ ] [BQM-TK225] **API: Stale session cleanup** — Background cleanup routine (invoked on-access or via scheduled interval) that marks sessions as inactive when `LastHeartbeat` is older than 5 minutes.
- [ ] [BQM-TK226] **UI: Advisory warning banner** — Display non-blocking banner when `activeEditors` contains other users. Auto-dismiss when editors list is empty. Poll every 15 seconds.
- [ ] [BQM-TK227] **UI: Heartbeat hook** — Custom React hook `useEditSession` that registers session on form mount (edit mode), sends heartbeat every 60 seconds, and releases on unmount/navigate-away/close.
- [ ] [BQM-TK228] **UI: Conflict resolution dialog** — Modal component showing: user's changes, latest version, diff view, and action buttons (Reload, Force-save [admin only], Cancel). Preserves form state.
- [ ] [BQM-TK229] **UI: Stale-data inline notification** — When a poll detects `configVersion` has incremented since the form was loaded, show an inline warning before the user attempts to save.
- [ ] [BQM-TK230] **Audit logging** — Force-save actions are logged in `app.RuleChangeAudit` with `ChangeType = 'ForceOverride'` and `OverrideReason` field.
- [ ] [BQM-TK231] **Unit tests** — Version mismatch detection, session registration/expiry, heartbeat lifecycle, force-save authorization.
- [ ] [BQM-TK232] **Integration tests** — Two concurrent sessions scenario: both load same version, first saves (success), second saves (409), second reloads and re-saves (success).
- [ ] [BQM-TK233] **Component tests** — Warning banner render, conflict dialog render with diff, button visibility by role.

### :link: Links

- **Epic:** EPIC-BQM-017 (`Documentation/Backlog/epics/epic-017-impact-preview-and-numerator-deduplication.md`)
- **Architecture:** `Documentation/ProjectSpecifications/architecture.md` — Section 4.7 (Concurrency Control for Rules Configuration)
- **Assumptions:** `Documentation/ProjectSpecifications/assumptions.md` — A37 (Optimistic Concurrency for Rules Config)
- **Depends on:** EPIC-BQM-008 (Denominator rules CRUD API must exist), EPIC-BQM-004 (Numerator rules CRUD API must exist)
- **Related:** BQM-US027 (Denominator rule configuration UI — save flow is modified to include version check)
- **Constitution:** Principle I — Data Integrity (no silent data loss), Principle II — Configuration-Driven Business Rules
- **Sprint:** (Assign via Milestone)

### Business Rules

- **Version scope**: `ConfigVersion` is tracked per `(ApplicationId, RuleScope)` combination. Denominator and numerator rules for the same application have independent version counters.
- **Atomic increment**: Version increment and rules persistence happen within a single database transaction. If the version check fails, no rows are modified.
- **Advisory-only locks**: Edit sessions are informational — they never block saves. A user can save even if another user has an active session (the version check is the enforcement gate).
- **Session auto-expiry**: Sessions without a heartbeat for > 5 minutes are considered stale and automatically cleaned up. This handles browser crashes, lost network, and abandoned tabs.
- **Heartbeat interval**: Client sends heartbeat every 60 seconds. Server considers session stale after 5 minutes (allows for network delays and missed heartbeats).
- **Force-save governance**: Only `administrator` role can force-save over a conflict. Force-saves are audit-logged with the override reason, the overwritten version, and the administrator's identity.
- **No pessimistic locks**: The system never blocks a user from opening or editing a form. All locking is advisory (informational) and optimistic (checked at save time).
- **Applies to both rule scopes**: The mechanism is generic — `RuleScope` parameter distinguishes `'denominator'` from `'numerator'` in sessions and version tracking.

### Concurrency Control Workflow

```
┌─────────────┐                  ┌─────────────┐
│   User A    │                  │   User B    │
└──────┬──────┘                  └──────┬──────┘
       │                                │
       │ 1. GET /filters/denom/:appId   │
       │    → version=5, rules=[...]    │
       │                                │
       │ 2. POST /edit-session          │
       │    → session registered        │
       │                                │ 3. GET /filters/denom/:appId
       │                                │    → version=5, rules=[...],
       │                                │       activeEditors=[{User A}]
       │                                │
       │                                │ 4. ⚠️ Banner: "User A is editing"
       │                                │
       │ 5. PUT /filters/denom/:appId   │
       │    body: {version:5, rules}    │
       │    → 200 OK, version=6         │
       │                                │
       │                                │ 6. Inline notification:
       │                                │    "Config updated by User A"
       │                                │
       │                                │ 7. PUT /filters/denom/:appId
       │                                │    body: {version:5, rules}
       │                                │    → 409 Conflict
       │                                │    {currentVersion:6,
       │                                │     currentRules:[...],
       │                                │     lastModifiedBy:"User A"}
       │                                │
       │                                │ 8. Conflict dialog shown:
       │                                │    [Reload] [Force-save*] [Cancel]
       │                                │    (* admin-only)
       │                                │
       │                                │ 9. User B clicks "Reload"
       │                                │    → Form loads version 6
       │                                │    → Re-applies changes
       │                                │
       │                                │ 10. PUT /filters/denom/:appId
       │                                │     body: {version:6, rules}
       │                                │     → 200 OK, version=7
       └────────────────────────────────┘
```

### Data Impact & Pipelines

- **New Table:** `app.ConfigVersions` (ApplicationId, RuleScope, Version, LastModifiedBy, LastModifiedAt) — tracks configuration version per scope.
- **New Table:** `app.ConfigEditSessions` (SessionId, ApplicationId, RuleScope, UserId, SessionStart, LastHeartbeat, IsActive) — tracks active editors.
- **Modified Tables:** `app.RuleChangeAudit` — add `ChangeType` and `OverrideReason` columns for force-save audit entries.
- **Reads:** `app.ConfigVersions` (on every GET and PUT), `app.ConfigEditSessions` (on GET for active editors, on cleanup sweep).
- **Writes:** `app.ConfigVersions` (version increment on successful save), `app.ConfigEditSessions` (session lifecycle), `app.RuleChangeAudit` (force-save logging).
- **Pipelines:** No ADF pipeline impact. Concurrency control is entirely within the API/UI layer.

### Non-Functional Requirements

- **Latency**: Version check and session lookup add < 50ms to save/load operations.
- **Session cleanup**: Stale sessions cleaned within 6 minutes maximum (5-minute expiry + 1-minute cleanup interval).
- **Poll frequency**: Client polls for `activeEditors` and `configVersion` changes every 15 seconds — minimal server load given < 20 concurrent users.
- **No data loss**: Under no circumstance should a user's form state be discarded without explicit user action (reload/cancel).
- **Graceful degradation**: If the edit session API is unavailable, the system degrades to pure optimistic concurrency (version check on save) — advisory banners become unavailable but saves remain safe.
