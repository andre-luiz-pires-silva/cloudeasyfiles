import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { openExternalUrl, type AwsRestoreTier } from "../../lib/tauri/awsConnections";

const AWS_RESTORE_DOCUMENTATION_URL =
  "https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html";
const AWS_PRICING_DOCUMENTATION_URL = "https://aws.amazon.com/s3/pricing/";

type AwsRestoreRequestPanelProps = {
  storageClass?: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (input: { tier: AwsRestoreTier; days: number }) => void;
  t: (key: string) => string;
};

type TierDescriptor = {
  value: AwsRestoreTier;
  titleKey: string;
  etaKey: string;
  costKey: string;
  useCaseKey: string;
};

const TIER_DESCRIPTORS: TierDescriptor[] = [
  {
    value: "expedited",
    titleKey: "restore.modal.aws.tier.expedited.title",
    etaKey: "restore.modal.aws.tier.expedited.eta",
    costKey: "restore.modal.aws.tier.expedited.cost",
    useCaseKey: "restore.modal.aws.tier.expedited.use_case"
  },
  {
    value: "standard",
    titleKey: "restore.modal.aws.tier.standard.title",
    etaKey: "restore.modal.aws.tier.standard.eta",
    costKey: "restore.modal.aws.tier.standard.cost",
    useCaseKey: "restore.modal.aws.tier.standard.use_case"
  },
  {
    value: "bulk",
    titleKey: "restore.modal.aws.tier.bulk.title",
    etaKey: "restore.modal.aws.tier.bulk.eta",
    costKey: "restore.modal.aws.tier.bulk.cost",
    useCaseKey: "restore.modal.aws.tier.bulk.use_case"
  }
];

export function AwsRestoreRequestPanel({
  storageClass,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
  t
}: AwsRestoreRequestPanelProps) {
  const availableTierDescriptors = useMemo(() => {
    const normalizedStorageClass = storageClass?.trim().toUpperCase() ?? "";

    if (normalizedStorageClass.includes("DEEP_ARCHIVE")) {
      return TIER_DESCRIPTORS.filter((descriptor) => descriptor.value !== "expedited");
    }

    return TIER_DESCRIPTORS;
  }, [storageClass]);
  const [selectedTier, setSelectedTier] = useState<AwsRestoreTier>(
    availableTierDescriptors.some((descriptor) => descriptor.value === "standard")
      ? "standard"
      : availableTierDescriptors[0]?.value ?? "bulk"
  );
  const [retentionDays, setRetentionDays] = useState("7");

  const parsedRetentionDays = Number.parseInt(retentionDays, 10);
  const isRetentionDaysValid = Number.isInteger(parsedRetentionDays) && parsedRetentionDays >= 1 && parsedRetentionDays <= 365;
  const selectedTierDescriptor = useMemo(
    () =>
      availableTierDescriptors.find((descriptor) => descriptor.value === selectedTier) ??
      availableTierDescriptors[0],
    [availableTierDescriptors, selectedTier]
  );

  useEffect(() => {
    if (availableTierDescriptors.some((descriptor) => descriptor.value === selectedTier)) {
      return;
    }

    setSelectedTier(availableTierDescriptors[0]?.value ?? "bulk");
  }, [availableTierDescriptors, selectedTier]);

  return (
    <form
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
      <div className="restore-modal-section">
        <div className="restore-modal-section-header">
          <strong>{t("restore.modal.aws.tier_label")}</strong>
          <span>{t("restore.modal.aws.tier_helper")}</span>
        </div>

        <div className="restore-tier-list">
          {availableTierDescriptors.map((descriptor) => {
            const checked = descriptor.value === selectedTier;

            return (
              <label
                key={descriptor.value}
                className={`restore-tier-card${checked ? " is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="restore-tier"
                  value={descriptor.value}
                  checked={checked}
                  onChange={() => setSelectedTier(descriptor.value)}
                />
                <span className="restore-tier-card-copy">
                  <strong>{t(descriptor.titleKey)}</strong>
                  <span>{t(descriptor.useCaseKey)}</span>
                </span>
                <span className="restore-tier-card-meta">
                  <span>{t("restore.modal.aws.eta_label")}: {t(descriptor.etaKey)}</span>
                  <span>{t("restore.modal.aws.cost_label")}: {t(descriptor.costKey)}</span>
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
              void openExternalUrl(AWS_PRICING_DOCUMENTATION_URL);
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
              void openExternalUrl(AWS_RESTORE_DOCUMENTATION_URL);
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
            .replace("{tier}", selectedTierDescriptor ? t(selectedTierDescriptor.titleKey) : selectedTier)
            .replace("{days}", String(isRetentionDaysValid ? parsedRetentionDays : retentionDays || "-"))}
        </p>
      </div>

      {submitError ? <p className="status-message-error">{submitError}</p> : null}

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
