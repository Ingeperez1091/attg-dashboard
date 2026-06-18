"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { Spinner } from "@/app/components/Spinner";
import { DenominatorRuleList } from "@/app/components/filters/DenominatorRuleList";
import { DenominatorRuleEditor } from "@/app/components/filters/DenominatorRuleEditor";
import { PreviewImpactPanel } from "@/app/components/filters/PreviewImpactPanel";
import { usePreviewSSE } from "@/app/components/filters/hooks/usePreviewSSE";
import { AdoptionSettingsPanel } from "@/app/components/filters/AdoptionSettingsPanel";
import { DenominatorModelFields } from "@/app/components/filters/DenominatorModelFields";
import {
  ConflictResolutionDialog,
  ConflictDetails,
} from "@/app/components/filters/ConflictResolutionDialog";
import {
  resolveUserDisplayName,
  UserDirectoryEntry,
} from "@/app/components/hooks/useUserAuditMetadata";
import { ApplicationOptionDto } from "@/core/application/dto/applications/ApplicationOptionDto";
import {
  AdoptionSettingsDto,
  AdoptionSettingsUpdateDto,
  DenominatorAuditHistoryEntryDto,
  DenominatorModelFieldDto,
  DenominatorRuleExpressionDto,
  DenominatorRulesetDto,
  DenominatorRuleViewDto,
} from "@/core/application/dto/denominator/DenominatorFilterDto";

export function DenominatorFiltersContent({ initialAppId, initialEditing }: { initialAppId?: string; initialEditing?: boolean } = {}) {
  const [applications, setApplications] = useState<ApplicationOptionDto[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>(initialAppId ?? "");
  const [modelFields, setModelFields] = useState<DenominatorModelFieldDto[]>(
    [],
  );
  const [ruleset, setRuleset] = useState<DenominatorRulesetDto | null>(null);
  const [draftRules, setDraftRules] = useState<DenominatorRuleExpressionDto[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(initialEditing ?? false);
  const [adoptionSettings, setAdoptionSettings] =
    useState<AdoptionSettingsDto | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(false);
  const [auditHistory, setAuditHistory] = useState<
    DenominatorAuditHistoryEntryDto[]
  >([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [auditLoadedAppId, setAuditLoadedAppId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [configVersion, setConfigVersion] = useState<number | null>(null);
  const [conflictState, setConflictState] = useState<ConflictDetails | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeEditors, setActiveEditors] = useState<{ userId: string; displayName?: string }[]>([]);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);

  const { state: previewState, startPreview, reset: resetPreview } = usePreviewSSE({
    appId: selectedAppId,
  });

  function actorLabel(actorUserId: string): string {
    return resolveUserDisplayName(actorUserId, users);
  }

  async function loadAuditHistory(applicationId: string): Promise<void> {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const response = await authenticatedFetch(
        `/api/filters/denominator/${applicationId}/audit`,
        { cache: "no-store" },
      );
      const body = await response.json();

      if (!response.ok) {
        setAuditError(body?.message ?? "Unable to load audit history.");
        setAuditHistory([]);
        return;
      }

      setAuditHistory(body.entries ?? []);
      setAuditLoadedAppId(applicationId);
    } catch {
      setAuditError("Unable to load audit history.");
      setAuditHistory([]);
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    async function loadApplications() {
      try {
        const response = await authenticatedFetch("/api/applications", {
          cache: "no-store",
        });
        const body = await response.json();
        const nextApplications = body.applications ?? [];
        setApplications(nextApplications);

        if (!initialAppId && nextApplications.length > 0) {
          setSelectedAppId(nextApplications[0].applicationId);
        }
      } catch {
        setError("Unable to load applications.");
      }
    }

    async function loadUsers() {
      try {
        const response = await authenticatedFetch("/api/users/directory", {
          cache: "no-store",
        });
        if (response.ok) {
          const body = await response.json();
          setUsers(body.users ?? []);
        }
      } catch {
        setUsers([]);
      }
    }

    loadApplications();
    loadUsers();
  }, []);

  const prevAppIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadDenominatorData() {
      if (!selectedAppId) {
        return;
      }

      const isAppChange = prevAppIdRef.current !== null && prevAppIdRef.current !== selectedAppId;
      prevAppIdRef.current = selectedAppId;

      setLoading(true);
      setError(null);
      resetPreview();
      if (isAppChange) {
        setEditing(false);
      }
      setAdoptionSettings(null);
      setAuditHistory([]);
      setAuditError(null);
      setAuditExpanded(false);
      setAuditLoadedAppId(null);
      setFieldsPanelOpen(false);

      try {
        const [modelResponse, rulesResponse, settingsResponse] =
          await Promise.all([
            authenticatedFetch("/api/denomindator-model", { cache: "no-store" }),
            authenticatedFetch(`/api/filters/denominator/${selectedAppId}`, {
              cache: "no-store",
            }),
            authenticatedFetch(`/api/filters/denominator/${selectedAppId}/settings`, {
              cache: "no-store",
            }),
          ]);

        if (!modelResponse.ok) {
          throw new Error("Unable to load denominator model.");
        }

        if (!rulesResponse.ok) {
          throw new Error("Unable to load denominator rules.");
        }

        const modelBody = await modelResponse.json();
        const rulesBody = await rulesResponse.json();
        const settingsBody = settingsResponse.ok
          ? await settingsResponse.json()
          : null;

        setModelFields(modelBody.fields ?? []);
        setRuleset({
          rules: rulesBody.rules ?? [],
          lastUpdatedAt: rulesBody.lastUpdatedAt ?? null,
          lastUpdatedBy: rulesBody.lastUpdatedBy ?? null,
        });
        setDraftRules(
          (rulesBody.rules ?? []).map((rule: DenominatorRuleViewDto) => ({
            denominatorModelId: rule.denominatorModelId,
            operator: rule.operator,
            value: rule.value,
          })),
        );
        setConfigVersion(rulesBody.configVersion ?? null);
        setIsAdmin(rulesBody.userRole === "administrator");
        setActiveEditors(rulesBody.activeEditors ?? []);
        setAdoptionSettings(settingsBody ?? null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unexpected error while loading denominator configuration.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDenominatorData();
  }, [selectedAppId]);

  async function handleSave(
    rulesToSave: DenominatorRuleExpressionDto[],
  ): Promise<void> {
    setSaving(true);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `/api/filters/denominator/${selectedAppId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: rulesToSave.map((rule) => ({
              denominatorModelId: rule.denominatorModelId,
              operator: rule.operator,
              value: rule.value.trim(),
            })),
            configVersion,
          }),
        },
      );

      const body = await response.json();

      if (response.status === 409 && body.error === "VERSION_CONFLICT") {
        setConflictState(body.details as ConflictDetails);
        return;
      }

      if (!response.ok) {
        setError(body?.message ?? "Unable to save denominator rules.");
        return;
      }

      const savedRules = body.rules ?? [];
      setRuleset({
        rules: savedRules,
        lastUpdatedAt: body.lastUpdatedAt ?? null,
        lastUpdatedBy: body.lastUpdatedBy ?? null,
      });
      setDraftRules(
        savedRules.map((rule: DenominatorRuleViewDto) => ({
          denominatorModelId: rule.denominatorModelId,
          operator: rule.operator,
          value: rule.value,
        })),
      );
      setConfigVersion(body.configVersion ?? null);
      setEditing(false);
      void releaseEditSession();
      if (auditExpanded) {
        await loadAuditHistory(selectedAppId);
      } else {
        setAuditLoadedAppId(null);
      }
    } catch {
      setError("Unable to save denominator rules.");
    } finally {
      setSaving(false);
    }
  }

  async function handleForceSave(reason: string): Promise<void> {
    setSaving(true);
    setError(null);
    setConflictState(null);

    try {
      const response = await authenticatedFetch(
        `/api/filters/denominator/${selectedAppId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rules: draftRules.map((rule) => ({
              denominatorModelId: rule.denominatorModelId,
              operator: rule.operator,
              value: rule.value.trim(),
            })),
            configVersion,
            forceOverride: true,
            overrideReason: reason,
          }),
        },
      );

      const body = await response.json();
      if (!response.ok) {
        setError(body?.message ?? "Unable to force-save denominator rules.");
        return;
      }

      const savedRules = body.rules ?? [];
      setRuleset({
        rules: savedRules,
        lastUpdatedAt: body.lastUpdatedAt ?? null,
        lastUpdatedBy: body.lastUpdatedBy ?? null,
      });
      setDraftRules(
        savedRules.map((rule: DenominatorRuleViewDto) => ({
          denominatorModelId: rule.denominatorModelId,
          operator: rule.operator,
          value: rule.value,
        })),
      );
      setConfigVersion(body.configVersion ?? null);
      setEditing(false);
      void releaseEditSession();
      if (auditExpanded) {
        await loadAuditHistory(selectedAppId);
      } else {
        setAuditLoadedAppId(null);
      }
    } catch {
      setError("Unable to force-save denominator rules.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConflictReload(): Promise<void> {
    setConflictState(null);
    setEditing(false);
    // Re-trigger data load by toggling selectedAppId
    const currentApp = selectedAppId;
    setSelectedAppId("");
    setTimeout(() => setSelectedAppId(currentApp), 0);
  }

  function handlePreviewImpact(): void {
    startPreview(
      draftRules.map((rule) => ({
        denominatorModelId: rule.denominatorModelId,
        operator: rule.operator,
        value: rule.value.trim(),
      }))
    );
  }

  function handleCancel(): void {
    setDraftRules(
      (ruleset?.rules ?? []).map((rule) => ({
        denominatorModelId: rule.denominatorModelId,
        operator: rule.operator,
        value: rule.value,
      })),
    );
    resetPreview();
    setEditing(false);
    setError(null);
    void releaseEditSession();
  }

  async function handleEnterEditMode(): Promise<void> {
    setEditing(true);
    try {
      const res = await authenticatedFetch(`/api/filters/denominator/${selectedAppId}/edit-session`, {
        method: "POST",
      });
      if (res.ok) {
        const body = await res.json();
        setEditSessionId(body.sessionId ?? null);
      }
    } catch {
      // Best-effort; editing still works without session tracking
    }
  }

  async function releaseEditSession(): Promise<void> {
    if (!editSessionId) return;
    const sid = editSessionId;
    setEditSessionId(null);
    try {
      await authenticatedFetch(`/api/filters/denominator/${selectedAppId}/edit-session`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      });
    } catch {
      // Best-effort cleanup
    }
  }

  async function handleSaveSettings(
    settings: AdoptionSettingsUpdateDto,
  ): Promise<void> {
    setSettingsSaving(true);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `/api/filters/denominator/${selectedAppId}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        },
      );

      const body = await response.json();
      if (!response.ok) {
        setError(body?.message ?? "Unable to save adoption settings.");
        return;
      }

      setAdoptionSettings(body);
      if (auditExpanded) {
        await loadAuditHistory(selectedAppId);
      } else {
        setAuditLoadedAppId(null);
      }
    } catch {
      setError("Unable to save adoption settings.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleAuditToggle(): Promise<void> {
    const nextExpanded = !auditExpanded;
    setAuditExpanded(nextExpanded);

    if (nextExpanded && auditLoadedAppId !== selectedAppId) {
      await loadAuditHistory(selectedAppId);
    }
  }

  return (
    <div className="filter-page">
      <div className="page-content-inner">
        <h1 className="page-title">Denominator Filter Configuration</h1>

        <ConflictResolutionDialog
          open={conflictState !== null}
          conflict={conflictState ?? { currentVersion: 0, currentRules: [], lastModifiedBy: "", lastModifiedAt: "" }}
          userRules={draftRules}
          isAdmin={isAdmin}
          onReload={handleConflictReload}
          onForceSave={handleForceSave}
          onCancel={() => setConflictState(null)}
        />

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="denominator-app-select">Application: </label>
          <select
            id="denominator-app-select"
            className="form-input"
            value={selectedAppId}
            onChange={(event) => setSelectedAppId(event.target.value)}
          >
            <option value="">Select an application...</option>
            {applications.map((app) => (
              <option key={app.applicationId} value={app.applicationId}>
                {app.applicationName}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="admin-alert" role="alert">
            {error}
          </div>
        )}

        {activeEditors.length > 0 && !editing && (
          <div className="admin-alert admin-alert--warning" data-testid="active-editors-warning">
            {activeEditors.map((e) => e.displayName ?? e.userId).join(", ")} {activeEditors.length === 1 ? "is" : "are"} currently editing this configuration.
          </div>
        )}

        {loading && <Spinner label="Loading denominator configuration..." />}

        {ruleset && !editing && !loading && (
          <div className="panel" style={{ padding: "1.25rem" }}>
            <DenominatorRuleList
              rules={ruleset.rules}
              lastUpdatedAt={ruleset.lastUpdatedAt}
              lastUpdatedBy={ruleset.lastUpdatedBy}
              userDirectory={users}
            />
            <button
              type="button"
              className="motif-action-button"
              onClick={() => void handleEnterEditMode()}
              style={{ marginTop: "16px" }}
            >
              Edit Rules
            </button>
          </div>
        )}

        {editing && !loading && (
          <div className="panel" style={{ padding: "1.25rem" }}>
            <DenominatorRuleEditor
              rules={draftRules}
              fields={modelFields}
              saving={saving}
              onUpdateRules={(rules) => {
                setDraftRules(rules);
                resetPreview();
              }}
              onSave={handleSave}
              onCancel={handleCancel}
            />
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                className="motif-action-button"
                onClick={handlePreviewImpact}
                disabled={previewState.status === "streaming" || saving}
              >
                {previewState.status === "streaming" ? "Previewing..." : "Preview Impact"}
              </button>
            </div>
            <PreviewImpactPanel
              state={previewState}
              onRetry={handlePreviewImpact}
            />
          </div>
        )}

        {selectedAppId && !loading && (
          <div
            className="panel"
            style={{ padding: "1.25rem", marginTop: "16px" }}
          >
            <AdoptionSettingsPanel
              settings={adoptionSettings}
              availableMetrics={modelFields
                .filter(
                  (field) => field.fieldType === "numeric" && field.isActive,
                )
                .map((field) => field.fieldName)}
              userDirectory={users}
              saving={settingsSaving}
              onSave={handleSaveSettings}
            />
          </div>
        )}

        {selectedAppId && !loading && (
          <div
            className="panel"
            style={{ padding: "1.25rem", marginTop: "16px" }}
          >
            <button
              type="button"
              className="motif-action-button"
              onClick={handleAuditToggle}
              aria-expanded={auditExpanded}
            >
              {auditExpanded ? "Hide Audit History" : "Show Audit History"}
            </button>

            {auditExpanded && (
              <div style={{ marginTop: "16px" }}>
                <h2 className="card__title">Audit History</h2>
                {auditLoading && <Spinner label="Loading audit history..." />}
                {auditError && <p>{auditError}</p>}

                {!auditLoading && !auditError && auditHistory.length === 0 && (
                  <p>No audit history found for this application.</p>
                )}

                {!auditLoading && !auditError && auditHistory.length > 0 && (
                  <div className="table-scroll-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Changed At</th>
                          <th>Scope</th>
                          <th>Actor</th>
                          <th>Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditHistory.map((entry) => (
                          <tr key={entry.auditId}>
                            <td>
                              {new Date(entry.changedAt).toLocaleString()}
                            </td>
                            <td>{entry.changeScope}</td>
                            <td>{actorLabel(entry.actorUserId)}</td>
                            <td>
                              {entry.changeScope === "Adoption"
                                ? "Adoption settings updated"
                                : "Denominator rules updated"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {modelFields.length > 0 && (
        <button
          type="button"
          className={`fields-panel-tab${fieldsPanelOpen ? " fields-panel-tab-open" : ""}`}
          onClick={() => setFieldsPanelOpen(!fieldsPanelOpen)}
          title="Show denominator field definitions"
          aria-label={
            fieldsPanelOpen
              ? "Hide denominator field definitions"
              : "Show denominator field definitions"
          }
        >
          <span className="fields-panel-tab-icon" aria-hidden="true">
            {fieldsPanelOpen ? "›" : "‹"}
          </span>
          <span className="fields-panel-tab-label">Fields</span>
        </button>
      )}

      <aside
        className={`fields-panel${fieldsPanelOpen && modelFields.length > 0 ? " fields-panel-visible" : ""}`}
        aria-hidden={!fieldsPanelOpen}
      >
        <div className="fields-panel-header">
          <h2 className="panel-title">Field Definitions</h2>
          <button
            type="button"
            className="fields-panel-close"
            onClick={() => setFieldsPanelOpen(false)}
            aria-label="Close field definitions panel"
          >
            ✕
          </button>
        </div>
        <DenominatorModelFields fields={modelFields} />
      </aside>

      {fieldsPanelOpen && modelFields.length > 0 && (
        <div
          className="fields-panel-backdrop"
          onClick={() => setFieldsPanelOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
