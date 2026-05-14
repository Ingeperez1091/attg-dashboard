"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import { DenominatorRuleList } from "@/app/components/filters/DenominatorRuleList";
import { DenominatorRuleEditor } from "@/app/components/filters/DenominatorRuleEditor";
import { DenominatorPreview } from "@/app/components/filters/DenominatorPreview";
import { AdoptionSettingsPanel } from "@/app/components/filters/AdoptionSettingsPanel";
import { DenominatorModelFields } from "@/app/components/filters/DenominatorModelFields";
import { resolveUserDisplayName, UserDirectoryEntry } from "@/app/components/hooks/useUserAuditMetadata";
import { ApplicationOptionDto } from "@/core/application/dto/applications/ApplicationOptionDto";
import {
  AdoptionSettingsDto,
  AdoptionSettingsUpdateDto,
  DenominatorAuditHistoryEntryDto,
  DenominatorModelFieldDto,
  DenominatorPreviewResultDto,
  DenominatorRuleExpressionDto,
  DenominatorRulesetDto,
  DenominatorRuleViewDto
} from "@/core/application/dto/denominator/DenominatorFilterDto";

export default function DenominatorFiltersPage() {
  const [applications, setApplications] = useState<ApplicationOptionDto[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [modelFields, setModelFields] = useState<DenominatorModelFieldDto[]>([]);
  const [ruleset, setRuleset] = useState<DenominatorRulesetDto | null>(null);
  const [draftRules, setDraftRules] = useState<DenominatorRuleExpressionDto[]>([]);
  const [preview, setPreview] = useState<DenominatorPreviewResultDto | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adoptionSettings, setAdoptionSettings] = useState<AdoptionSettingsDto | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(false);
  const [auditHistory, setAuditHistory] = useState<DenominatorAuditHistoryEntryDto[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [auditLoadedAppId, setAuditLoadedAppId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);

  function actorLabel(actorUserId: string): string {
    return resolveUserDisplayName(actorUserId, users);
  }

  async function loadAuditHistory(applicationId: string): Promise<void> {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const response = await fetch(`/api/filters/denominator/${applicationId}/audit`, { cache: "no-store" });
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
        const response = await fetch("/api/applications", { cache: "no-store" });
        const body = await response.json();
        const nextApplications = body.applications ?? [];
        setApplications(nextApplications);

        if (nextApplications.length > 0) {
          setSelectedAppId(nextApplications[0].applicationId);
        }
      } catch {
        setError("Unable to load applications.");
      }
    }

    async function loadUsers() {
      try {
        const response = await fetch("/api/users/directory", { cache: "no-store" });
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

  useEffect(() => {
    async function loadDenominatorData() {
      if (!selectedAppId) {
        return;
      }

      setLoading(true);
      setError(null);
      setPreview(null);
      setPreviewError(null);
      setEditing(false);
      setAdoptionSettings(null);
      setAuditHistory([]);
      setAuditError(null);
      setAuditExpanded(false);
      setAuditLoadedAppId(null);
      setFieldsPanelOpen(false);

      try {
        const [modelResponse, rulesResponse, settingsResponse] = await Promise.all([
          fetch("/api/denomindator-model", { cache: "no-store" }),
          fetch(`/api/filters/denominator/${selectedAppId}`, { cache: "no-store" }),
          fetch(`/api/filters/denominator/${selectedAppId}/settings`, { cache: "no-store" })
        ]);

        if (!modelResponse.ok) {
          throw new Error("Unable to load denominator model.");
        }

        if (!rulesResponse.ok) {
          throw new Error("Unable to load denominator rules.");
        }

        const modelBody = await modelResponse.json();
        const rulesBody = await rulesResponse.json();
        const settingsBody = settingsResponse.ok ? await settingsResponse.json() : null;

        setModelFields(modelBody.fields ?? []);
        setRuleset({
          rules: rulesBody.rules ?? [],
          lastUpdatedAt: rulesBody.lastUpdatedAt ?? null,
          lastUpdatedBy: rulesBody.lastUpdatedBy ?? null
        });
        setDraftRules((rulesBody.rules ?? []).map((rule: DenominatorRuleViewDto) => ({
          denominatorModelId: rule.denominatorModelId,
          operator: rule.operator,
          value: rule.value
        })));
        setAdoptionSettings(settingsBody ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unexpected error while loading denominator configuration.");
      } finally {
        setLoading(false);
      }
    }

    loadDenominatorData();
  }, [selectedAppId]);

  async function handleSave(rulesToSave: DenominatorRuleExpressionDto[]): Promise<void> {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/filters/denominator/${selectedAppId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rulesToSave.map((rule) => ({
            denominatorModelId: rule.denominatorModelId,
            operator: rule.operator,
            value: rule.value.trim()
          }))
        })
      });

      const body = await response.json();
      if (!response.ok) {
        setError(body?.message ?? "Unable to save denominator rules.");
        return;
      }

      const savedRules = body.rules ?? [];
      setRuleset({
        rules: savedRules,
        lastUpdatedAt: body.lastUpdatedAt ?? null,
        lastUpdatedBy: body.lastUpdatedBy ?? null
      });
      setDraftRules(savedRules.map((rule: DenominatorRuleViewDto) => ({
        denominatorModelId: rule.denominatorModelId,
        operator: rule.operator,
        value: rule.value
      })));
      setEditing(false);
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

  async function handlePreview(rulesToPreview: DenominatorRuleExpressionDto[]): Promise<void> {
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await fetch(`/api/filters/denominator/${selectedAppId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rulesToPreview.map((rule) => ({
            denominatorModelId: rule.denominatorModelId,
            operator: rule.operator,
            value: rule.value.trim()
          }))
        })
      });

      const body = await response.json();
      if (!response.ok) {
        setPreviewError(body?.message ?? "Unable to calculate preview.");
        return;
      }

      setPreview(body);
    } catch {
      setPreviewError("Unable to calculate preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleCancel(): void {
    setDraftRules((ruleset?.rules ?? []).map((rule) => ({
      denominatorModelId: rule.denominatorModelId,
      operator: rule.operator,
      value: rule.value
    })));
    setPreview(null);
    setPreviewError(null);
    setEditing(false);
    setError(null);
  }

  async function handleSaveSettings(settings: AdoptionSettingsUpdateDto): Promise<void> {
    setSettingsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/filters/denominator/${selectedAppId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

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
              onClick={() => setEditing(true)}
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
                setPreview(null);
                setPreviewError(null);
              }}
              onSave={handleSave}
              onCancel={handleCancel}
            />
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                className="motif-action-button"
                onClick={() => handlePreview(draftRules)}
                disabled={previewLoading || saving}
              >
                {previewLoading ? "Previewing..." : "Preview"}
              </button>
            </div>
            <DenominatorPreview
              preview={preview}
              loading={previewLoading}
              error={previewError}
            />
          </div>
        )}

        {selectedAppId && !loading && (
          <div className="panel" style={{ padding: "1.25rem", marginTop: "16px" }}>
            <AdoptionSettingsPanel
              settings={adoptionSettings}
              availableMetrics={modelFields
                .filter((field) => field.fieldType === "numeric" && field.isActive)
                .map((field) => field.fieldName)}
              userDirectory={users}
              saving={settingsSaving}
              onSave={handleSaveSettings}
            />
          </div>
        )}

        {selectedAppId && !loading && (
          <div className="panel" style={{ padding: "1.25rem", marginTop: "16px" }}>
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
                          <td>{new Date(entry.changedAt).toLocaleString()}</td>
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
          aria-label={fieldsPanelOpen ? "Hide denominator field definitions" : "Show denominator field definitions"}
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
