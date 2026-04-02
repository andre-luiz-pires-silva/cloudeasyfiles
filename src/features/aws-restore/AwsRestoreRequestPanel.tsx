import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "../../lib/i18n/I18nProvider";
import { openExternalUrl, type AwsRestoreTier } from "../../lib/tauri/awsConnections";
import { getAwsRestoreTierContent } from "../aws/awsProviderContent";

type AwsRestoreRequestPanelProps = {
  locale: Locale;
  storageClass?: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (input: { tier: AwsRestoreTier; days: number }) => void;
  t: (key: string) => string;
};

export function AwsRestoreRequestPanel({
  locale,
  storageClass,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
  t
}: AwsRestoreRequestPanelProps) {
  const content = getAwsRestoreTierContent(locale);
  const availableTierDescriptors = useMemo(() => {
    const normalizedStorageClass = storageClass?.trim().toUpperCase() ?? "";

    if (normalizedStorageClass.includes("DEEP_ARCHIVE")) {
      return content.options.filter((descriptor) => descriptor.tier !== "expedited");
    }

    return content.options;
  }, [content.options, storageClass]);
  const [selectedTier, setSelectedTier] = useState<AwsRestoreTier>(
    availableTierDescriptors.some((descriptor) => descriptor.tier === "standard")
      ? "standard"
      : availableTierDescriptors[0]?.tier ?? "bulk"
  );
  const [retentionDays, setRetentionDays] = useState("7");

  const parsedRetentionDays = Number.parseInt(retentionDays, 10);
  const isRetentionDaysValid = Number.isInteger(parsedRetentionDays) && parsedRetentionDays >= 1 && parsedRetentionDays <= 365;
  const selectedTierDescriptor = useMemo(
    () =>
      availableTierDescriptors.find((descriptor) => descriptor.tier === selectedTier) ??
      availableTierDescriptors[0],
    [availableTierDescriptors, selectedTier]
  );

  useEffect(() => {
    if (availableTierDescriptors.some((descriptor) => descriptor.tier === selectedTier)) {
      return;
    }

    setSelectedTier(availableTierDescriptors[0]?.tier ?? "bulk");
  }, [availableTierDescriptors, selectedTier]);

  return (
    <form
      className="modal-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (!isRetentionDaysValid) {
          return;
        }

        onSubmit({
          tier: selectedTier,
          days: parsedRetentionDays
        });
      }}
    >
      <div className="modal-scroll-panel">
        <div className="modal-scroll-viewport">
          <div className="restore-modal-section">
            <div className="restore-modal-section-header">
              <strong>{t("restore.modal.aws.tier_label")}</strong>
              <span>{t("restore.modal.aws.tier_helper")}</span>
            </div>

            <div className="restore-tier-list">
              {availableTierDescriptors.map((descriptor) => {
                const checked = descriptor.tier === selectedTier;

                return (
                  <label
                    key={descriptor.tier}
                    className={`restore-tier-card${checked ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="restore-tier"
                      value={descriptor.tier}
                      checked={checked}
                      onChange={() => setSelectedTier(descriptor.tier)}
                    />
                    <span className={`restore-tier-card-indicator${checked ? " is-selected" : ""}`}>
                      <span className="restore-tier-card-indicator-dot" />
                    </span>
                    <span className="restore-tier-card-content">
                      <span className="restore-tier-card-copy">
                        <strong>{descriptor.title}</strong>
                        <span>{descriptor.useCase}</span>
                      </span>
                      <span className="restore-tier-card-meta">
                        <span>{t("restore.modal.aws.eta_label")}: {descriptor.eta}</span>
                        <span>{t("restore.modal.aws.cost_label")}: {descriptor.cost}</span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="field-group" htmlFor="restore-retention-days">
            <span>{t("restore.modal.aws.days_label")}</span>
            <input
              id="restore-retention-days"
              type="number"
              min={1}
              max={365}
              inputMode="numeric"
              value={retentionDays}
              onChange={(event) => setRetentionDays(event.target.value)}
            />
            <span className="field-helper">{t("restore.modal.aws.days_helper")}</span>
            {isRetentionDaysValid ? null : (
              <span className="field-error">{t("restore.modal.aws.days_validation")}</span>
            )}
          </label>

          <div className="restore-modal-section restore-modal-note">
            <strong>{t("restore.modal.aws.cost_note_title")}</strong>
            <p>
              {t("restore.modal.aws.cost_note_body")}{" "}
              <button
                type="button"
                className="restore-inline-link"
                onClick={() => {
                  void openExternalUrl(content.pricingDocumentationUrl);
                }}
              >
                {t("restore.modal.aws.docs.pricing")}
              </button>
              .
            </p>
            <p>
              {t("restore.modal.aws.retention_note_body")}{" "}
              <button
                type="button"
                className="restore-inline-link"
                onClick={() => {
                  void openExternalUrl(content.restoreDocumentationUrl);
                }}
              >
                {t("restore.modal.aws.docs.restore")}
              </button>
              .
            </p>
          </div>

          <div className="restore-modal-section restore-modal-confirmation">
            <strong>{t("restore.modal.confirmation_title")}</strong>
            <p>
              {t("restore.modal.aws.confirmation_summary")
                .replace("{tier}", selectedTierDescriptor ? selectedTierDescriptor.title : selectedTier)
                .replace(
                  "{days}",
                  String(isRetentionDaysValid ? parsedRetentionDays : retentionDays || "-")
                )}
            </p>
            <p>{t("restore.modal.aws.confirmation_warning")}</p>
          </div>

          {submitError ? <p className="status-message-error">{submitError}</p> : null}
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="primary-button" disabled={isSubmitting || !isRetentionDaysValid}>
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
    </form>
  );
}
