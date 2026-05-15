"use client";

import { useState } from "react";
import { Spinner } from "@/app/components/Spinner";
import { resolveUserDisplayName, UserDirectoryEntry } from "@/app/components/hooks/useUserAuditMetadata";
import {
  AdoptionSettingsDto,
  AdoptionSettingsUpdateDto
} from "@/core/application/dto/denominator/DenominatorFilterDto";

type AdoptionSettingsPanelProps = {
  settings: AdoptionSettingsDto | null;
  availableMetrics: string[];
  userDirectory?: UserDirectoryEntry[];
  saving?: boolean;
  onSave: (updated: AdoptionSettingsUpdateDto) => void;
};

export function AdoptionSettingsPanel({
  settings,
  availableMetrics,
  userDirectory = [],
  saving = false,
  onSave
}: AdoptionSettingsPanelProps) {
  const [adoptionLevel, setAdoptionLevel] = useState<"Engagement" | "Client">(
    settings?.adoptionLevel ?? "Engagement"
  );
  const [revenueMetric, setRevenueMetric] = useState<string>(
    settings?.revenueMetric ?? availableMetrics[0] ?? ""
  );
  const [numeratorSource, setNumeratorSource] = useState<"API" | "Manual">(
    settings?.numeratorSource ?? "API"
  );
  const [showValidation, setShowValidation] = useState(false);

  const isValid = adoptionLevel && revenueMetric.trim().length > 0 && numeratorSource;
  const updatedByName = settings?.updatedBy
    ? resolveUserDisplayName(settings.updatedBy, userDirectory)
    : "Unknown";

  function handleSave() {
    if (!isValid) {
      setShowValidation(true);
      return;
    }

    onSave({ adoptionLevel, revenueMetric, numeratorSource });
  }

  return (
    <section className="card" style={{ marginTop: "16px" }}>
      <h2 className="card__title">Adoption Settings</h2>

      <div style={{ marginBottom: "12px" }}>
        <fieldset>
          <legend>Adoption Level</legend>
          <label>
            <input
              type="radio"
              name="adoptionLevel"
              value="Engagement"
              checked={adoptionLevel === "Engagement"}
              onChange={() => setAdoptionLevel("Engagement")}
            />
            {" "}Engagement
          </label>
          <label style={{ marginLeft: "12px" }}>
            <input
              type="radio"
              name="adoptionLevel"
              value="Client"
              checked={adoptionLevel === "Client"}
              onChange={() => setAdoptionLevel("Client")}
            />
            {" "}Client
          </label>
        </fieldset>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label htmlFor="revenue-metric">Revenue Metric</label>
        <select
          id="revenue-metric"
          className="form-input"
          value={revenueMetric}
          onChange={(event) => setRevenueMetric(event.target.value)}
          aria-invalid={showValidation && !revenueMetric.trim()}
          style={{ marginLeft: "8px" }}
        >
          {availableMetrics.length === 0 && (
            <option value="">No numeric fields available</option>
          )}
          {availableMetrics.map((metric) => (
            <option key={metric} value={metric}>
              {metric}
            </option>
          ))}
        </select>
        {showValidation && !revenueMetric.trim() && (
          <p className="admin-alert" role="alert">Revenue metric is required.</p>
        )}
      </div>

      <div style={{ marginBottom: "12px" }}>
        <fieldset>
          <legend>Numerator Source</legend>
          <label>
            <input
              type="radio"
              name="numeratorSource"
              value="API"
              checked={numeratorSource === "API"}
              onChange={() => setNumeratorSource("API")}
            />
            {" "}API
          </label>
          <label style={{ marginLeft: "12px" }}>
            <input
              type="radio"
              name="numeratorSource"
              value="Manual"
              checked={numeratorSource === "Manual"}
              onChange={() => setNumeratorSource("Manual")}
            />
            {" "}Manual
          </label>
        </fieldset>
      </div>

      <div>
        <button
          type="button"
          className="filter-rule-btn filter-rule-btn-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Spinner size="sm" label="Saving..." inline /> : "Save Settings"}
        </button>
      </div>

      {settings?.updatedAt && (
        <p style={{ marginTop: "12px" }}>
          Last updated: {new Date(settings.updatedAt).toLocaleString()} by {updatedByName}
        </p>
      )}
    </section>
  );
}
