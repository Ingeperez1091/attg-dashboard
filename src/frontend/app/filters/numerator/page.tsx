"use client";

import { useEffect, useState } from "react";
import { ApplicationModelFields } from "@/app/components/filters/ApplicationModelFields";
import { NumeratorRuleEditor } from "@/app/components/filters/NumeratorRuleEditor";
import { NumeratorRuleList } from "@/app/components/filters/NumeratorRuleList";
import { Spinner } from "@/app/components/Spinner";
import { UserDirectoryEntry } from "@/app/components/hooks/useUserAuditMetadata";
import { ApplicationOptionDto } from "@/core/application/dto/applications/ApplicationOptionDto";
import {
  NumeratorApplicationModelDto,
  NumeratorRuleExpressionDto,
  NumeratorRulesetDto,
  NumeratorRuleViewDto
} from "@/core/application/dto/numerator/NumeratorFilterDto";

export default function NumeratorFiltersPage() {
  const [applications, setApplications] = useState<ApplicationOptionDto[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [model, setModel] = useState<NumeratorApplicationModelDto | null>(null);
  const [rulesData, setRulesData] = useState<NumeratorRulesetDto | null>(null);
  const [draftRules, setDraftRules] = useState<NumeratorRuleExpressionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(false);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);

  useEffect(() => {
    async function loadApplications() {
      try {
        const response = await fetch("/api/applications", { cache: "no-store" });
        const body = await response.json();
        const nextApps: ApplicationOptionDto[] = body.applications ?? [];
        setApplications(nextApps);

        if (nextApps.length > 0 && !selectedAppId) {
          setSelectedAppId(nextApps[0].applicationId);
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
          const userList = body.users ?? [];
          setUsers(userList);
        }
      } catch {
        // Silently fail if users can't be loaded - audit display will still work with userId
        setUsers([]);
      }
    }

    loadApplications();
    loadUsers();
  }, []);

  useEffect(() => {
    async function loadRulesPageData() {
      if (!selectedAppId) {
        setModel(null);
        setRulesData(null);
        return;
      }

      setLoading(true);
      setError(null);
      setEditing(false);

      try {
        const [modelResponse, rulesResponse] = await Promise.all([
          fetch(`/api/applications/${selectedAppId}/numeratormodel`, { cache: "no-store" }),
          fetch(`/api/filters/numerator/${selectedAppId}`, { cache: "no-store" })
        ]);

        if (!modelResponse.ok) {
          throw new Error("Unable to load model fields.");
        }

        const modelBody = await modelResponse.json();
        const fields = modelBody.fields ?? [];
        setModel({ fields });

        if (rulesResponse.status === 404) {
          setRulesData({ rules: [], lastUpdatedAt: null, lastUpdatedBy: null });
          setDraftRules([]);
        } else if (rulesResponse.ok) {
          const rulesBody = await rulesResponse.json();
          const loadedRules = rulesBody.rules ?? [];
          setRulesData({
            rules: loadedRules,
            lastUpdatedAt: rulesBody.lastUpdatedAt ?? null,
            lastUpdatedBy: rulesBody.lastUpdatedBy ?? null
          });
          setDraftRules(
            loadedRules.map((rule: NumeratorRuleViewDto) => ({
              applicationModelId: rule.applicationModelFieldId,
              operator: rule.operator,
              value: rule.value
            }))
          );
        } else {
          throw new Error("Unable to load existing rules.");
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unexpected error while loading filter configuration.");
      } finally {
        setLoading(false);
      }
    }

    loadRulesPageData();
  }, [selectedAppId]);

  async function handleSave(rulesToSave: NumeratorRuleExpressionDto[]): Promise<void> {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/filters/numerator/${selectedAppId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rulesToSave.map((rule) => ({
            applicationModelFieldId: rule.applicationModelId,
            operator: rule.operator,
            value: rule.value.trim()
          }))
        })
      });

      const body = await response.json();
      if (!response.ok) {
        if (body?.details?.code === "FIELD_NOT_FILTERABLE") {
          setError("Selected field is not filterable.");
          return;
        }

        setError(body?.message ?? "Save failed.");
        return;
      }

      const savedRules = body.rules ?? [];
      setRulesData({
        rules: savedRules,
        lastUpdatedAt: body.lastUpdatedAt ?? null,
        lastUpdatedBy: body.lastUpdatedBy ?? null
      });
      setDraftRules(
        savedRules.map((rule: NumeratorRuleViewDto) => ({
          applicationModelId: rule.applicationModelFieldId,
          operator: rule.operator,
          value: rule.value
        }))
      );
      setEditing(false);
    } catch {
      setError("Unable to save filter rules.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel(): void {
    setDraftRules(
      rulesData?.rules.map((rule) => ({
        applicationModelId: rule.applicationModelFieldId,
        operator: rule.operator,
        value: rule.value
      })) ?? []
    );
    setEditing(false);
    setError(null);
  }

  return (
    <div className="filter-page">
      <div className="page-content-inner">
        <h1 className="page-title">Numerator Filter Configuration</h1>

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="app-select">Application: </label>
          <select
            id="app-select"
            className="form-input"
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
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

        {selectedAppId && loading && <Spinner label="Loading filter configuration…" />}

        {rulesData && !editing && !loading && (
          <div className="panel" style={{ padding: "1.25rem" }}>
            <NumeratorRuleList
              rules={rulesData.rules}
              lastUpdatedAt={rulesData.lastUpdatedAt}
              lastUpdatedBy={rulesData.lastUpdatedBy}
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

        {model && editing && !loading && (
          <div className="panel" style={{ padding: "1.25rem" }}>
            <NumeratorRuleEditor
              rules={draftRules}
              fields={model.fields}
              onUpdateRules={setDraftRules}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
            />
          </div>
        )}
      </div>

      {/* ── Side panel toggle tab ── */}
      {model && (
        <button
          type="button"
          className={`fields-panel-tab${fieldsPanelOpen ? " fields-panel-tab-open" : ""}`}
          onClick={() => setFieldsPanelOpen(!fieldsPanelOpen)}
          title="Show application field definitions"
          aria-label={fieldsPanelOpen ? "Hide field definitions" : "Show field definitions"}
        >
          <span className="fields-panel-tab-icon" aria-hidden="true">
            {fieldsPanelOpen ? "›" : "‹"}
          </span>
          <span className="fields-panel-tab-label">Fields</span>
        </button>
      )}

      {/* ── Slide-out fields panel ── */}
      <aside
        className={`fields-panel${fieldsPanelOpen && model ? " fields-panel-visible" : ""}`}
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
        {model && <ApplicationModelFields fields={model.fields} />}
      </aside>

      {/* ── Backdrop ── */}
      {fieldsPanelOpen && model && (
        <div
          className="fields-panel-backdrop"
          onClick={() => setFieldsPanelOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}