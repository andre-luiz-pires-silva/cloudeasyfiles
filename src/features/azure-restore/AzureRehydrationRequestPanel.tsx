import { LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Locale } from "../../lib/i18n/I18nProvider";
import type { AzureRehydrationPriority } from "../../lib/tauri/azureConnections";
import { openExternalUrl } from "../../lib/tauri/awsConnections";
import { getAzureUploadTierContent } from "../azure/azureProviderContent";
import { StorageTierSelector } from "../connections/components/StorageTierSelector";
import type { AzureUploadTier } from "../connections/azureUploadTiers";

type AzureRehydrationRequestPanelProps = {
  locale: Locale;
  fileCount?: number;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (input: {
    targetTier: Exclude<AzureUploadTier, "Archive">;
    priority: AzureRehydrationPriority;
  }) => void;
  t: (key: string) => string;
};

export function AzureRehydrationRequestPanel({
  locale: _locale,
  fileCount = 1,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
  t
}: AzureRehydrationRequestPanelProps) {
  const content = getAzureUploadTierContent(t);
  const [selectedTier, setSelectedTier] = useState<Exclude<AzureUploadTier, "Archive">>("Hot");
  const [priority, setPriority] = useState<AzureRehydrationPriority>("Standard");
  const confirmationSummary = useMemo(
    () =>
      (fileCount > 1
        ? t("restore.modal.azure.confirmation_summary_batch").replace(
            "{count}",
            String(fileCount)
          )
        : t("restore.modal.azure.confirmation_summary")
      )
        .replace("{tier}", selectedTier)
        .replace("{priority}", priority),
    [fileCount, priority, selectedTier, t]
  );

  return (
    <form
      className="modal-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          targetTier: selectedTier,
          priority
        });
      }}
    >
      <div className="modal-scroll-panel">
        <div className="modal-scroll-viewport">
          <StorageTierSelector
            value={selectedTier}
            onChange={(value) => setSelectedTier(value as Exclude<AzureUploadTier, "Archive">)}
            content={{
              ...content,
              label: t("restore.modal.azure.tier_label"),
              helper: t("restore.modal.azure.tier_helper")
            }}
            name="azure-rehydration-tier"
            allowedOptions={["Hot", "Cool", "Cold"]}
          />

          <div className="restore-modal-section">
            <div className="restore-modal-section-header">
              <strong>{t("restore.modal.azure.priority_label")}</strong>
              <span>{t("restore.modal.azure.priority_helper")}</span>
            </div>

            <div className="restore-tier-list">
              {(["Standard", "High"] as const).map((value) => {
                const checked = value === priority;

                return (
                  <label
                    key={value}
                    className={`restore-tier-card${checked ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="azure-rehydration-priority"
                      value={value}
                      checked={checked}
                      onChange={() => setPriority(value)}
                    />
                    <span className={`restore-tier-card-indicator${checked ? " is-selected" : ""}`}>
                      <span className="restore-tier-card-indicator-dot" />
                    </span>
                    <span className="restore-tier-card-content">
                      <span className="restore-tier-card-copy">
                        <strong>{t(`restore.modal.azure.priority.${value.toLowerCase()}.title`)}</strong>
                        <span>{t(`restore.modal.azure.priority.${value.toLowerCase()}.use_case`)}</span>
                      </span>
                      <span className="restore-tier-card-meta">
                        <span>
                          {t("restore.modal.azure.eta_label")}:{" "}
                          {t(`restore.modal.azure.priority.${value.toLowerCase()}.eta`)}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="restore-modal-section restore-modal-note">
            <strong>{t("restore.modal.azure.note_title")}</strong>
            <p>
              {t("restore.modal.azure.note_body")}{" "}
              <button
                type="button"
                className="restore-inline-link"
                onClick={() => {
                  void openExternalUrl(content.pricingDocumentationUrl ?? "");
                }}
              >
                {t("restore.modal.azure.docs.pricing")}
              </button>
              .
            </p>
            <p>
              {t("restore.modal.azure.note_docs_body")}{" "}
              <button
                type="button"
                className="restore-inline-link"
                onClick={() => {
                  void openExternalUrl(content.storageClassesDocumentationUrl ?? "");
                }}
              >
                {t("restore.modal.azure.docs.rehydration")}
              </button>
              .
            </p>
          </div>

          <div className="restore-modal-section restore-modal-confirmation">
            <strong>{t("restore.modal.confirmation_title")}</strong>
            <p>{confirmationSummary}</p>
            <p>{t("restore.modal.azure.confirmation_warning")}</p>
          </div>

          {submitError ? <p className="status-message-error">{submitError}</p> : null}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle size={16} strokeWidth={2} className="restore-submit-spinner" />
                  <span>{t("restore.modal.submitting")}</span>
                </>
              ) : (
                t("navigation.menu.restore")
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
