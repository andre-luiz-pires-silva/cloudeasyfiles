import { LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Locale } from "../../lib/i18n/I18nProvider";
import type { AwsUploadStorageClass } from "../connections/awsUploadStorageClasses";
import { normalizeAwsUploadStorageClass } from "../connections/awsUploadStorageClasses";
import { AwsStorageClassSelector } from "../connections/components/AwsStorageClassSelector";
import type { AzureUploadTier } from "../connections/azureUploadTiers";
import { normalizeAzureUploadTier } from "../connections/azureUploadTiers";
import { getAwsChangeTierContent } from "../aws/awsProviderContent";
import { getAzureUploadTierContent } from "../azure/azureProviderContent";
import type { ConnectionProvider } from "../connections/models";
import { StorageTierSelector } from "../connections/components/StorageTierSelector";

export type ChangeStorageClassRequestSummary = {
  fileCount: number;
  totalSizeLabel?: string | null;
  currentStorageClassLabel?: string | null;
};

type ChangeStorageClassModalProps = {
  provider: ConnectionProvider;
  locale: Locale;
  request: ChangeStorageClassRequestSummary;
  initialStorageClass?: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (storageClass: AwsUploadStorageClass | AzureUploadTier) => void;
  t: (key: string) => string;
};

export function ChangeStorageClassModal({
  provider,
  locale,
  request,
  initialStorageClass,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
  t
}: ChangeStorageClassModalProps) {
  const isAws = provider === "aws";
  const awsContent = getAwsChangeTierContent(t);
  const azureContent = getAzureUploadTierContent(t);
  const content = isAws ? awsContent : azureContent;
  const normalizedInitialStorageClass = initialStorageClass
    ? isAws
      ? normalizeAwsUploadStorageClass(initialStorageClass)
      : normalizeAzureUploadTier(initialStorageClass)
    : null;
  const [selectedStorageClass, setSelectedStorageClass] = useState<
    AwsUploadStorageClass | AzureUploadTier | null
  >(normalizedInitialStorageClass);
  const requiresExplicitSelection = normalizedInitialStorageClass === null;
  const hasSelectedStorageClass = selectedStorageClass !== null;
  const isSameStorageClass =
    normalizedInitialStorageClass !== null && normalizedInitialStorageClass === selectedStorageClass;
  const title = t("content.storage_class_change.title").replace(
    "{count}",
    String(request.fileCount)
  );
  const confirmationSummary = useMemo(
    () =>
      t(
        isAws
          ? "content.storage_class_change.confirmation_summary"
          : "content.azure_storage_class_change.confirmation_summary"
      )
        .replace("{count}", String(request.fileCount))
        .replace(
          "{storageClass}",
          selectedStorageClass ?? t("content.storage_class_change.choose_destination_placeholder")
        ),
    [isAws, request.fileCount, selectedStorageClass, t]
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card modal-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-storage-class-modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">
              {t(
                isAws
                  ? "content.storage_class_change.eyebrow"
                  : "content.azure_storage_class_change.eyebrow"
              )}
            </p>
            <h2 id="change-storage-class-modal-title" className="modal-title">
              {isAws
                ? title
                : t("content.azure_storage_class_change.title").replace(
                    "{count}",
                    String(request.fileCount)
                  )}
            </h2>
            <p className="restore-modal-header-meta">
              <span>
                {t("content.storage_class_change.selection_count").replace(
                  "{count}",
                  String(request.fileCount)
                )}
              </span>
              {request.totalSizeLabel ? <span>{request.totalSizeLabel}</span> : null}
              {request.currentStorageClassLabel ? <span>{request.currentStorageClassLabel}</span> : null}
            </p>
            <p className="modal-copy">
              {t(
                isAws
                  ? "content.storage_class_change.intro"
                  : "content.azure_storage_class_change.intro"
              )}
            </p>
          </div>
        </div>

        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();

            if (!selectedStorageClass || isSameStorageClass) {
              return;
            }

            onSubmit(selectedStorageClass);
          }}
        >
          <div className="modal-scroll-panel">
            <div className="modal-scroll-viewport">
              {isAws ? (
                <AwsStorageClassSelector
                  value={selectedStorageClass as AwsUploadStorageClass | null}
                  onChange={setSelectedStorageClass}
                  content={awsContent}
                  name="aws-change-storage-class"
                />
              ) : (
                <StorageTierSelector
                  value={selectedStorageClass as AzureUploadTier | null}
                  onChange={setSelectedStorageClass}
                  content={{
                    ...azureContent,
                    label: t("content.azure_storage_class_change.destination_label"),
                    helper: t("content.azure_storage_class_change.destination_helper")
                  }}
                  name="azure-change-storage-class"
                />
              )}

              <div className="restore-modal-section restore-modal-confirmation">
                <strong>{t("restore.modal.confirmation_title")}</strong>
                <p>{confirmationSummary}</p>
                <p>
                  {t(
                    isAws
                      ? "content.storage_class_change.confirmation_warning"
                      : "content.azure_storage_class_change.confirmation_warning"
                  )}
                </p>
              </div>

              {isSameStorageClass ? (
                <p className="status-message-error">
                  {t(
                    isAws
                      ? "content.storage_class_change.same_class_error"
                      : "content.azure_storage_class_change.same_class_error"
                  )}
                </p>
              ) : null}

              {requiresExplicitSelection && !hasSelectedStorageClass ? (
                <p className="status-message-error">
                  {t(
                    isAws
                      ? "content.storage_class_change.choose_destination_error"
                      : "content.azure_storage_class_change.choose_destination_error"
                  )}
                </p>
              ) : null}

              {submitError ? <p className="status-message-error">{submitError}</p> : null}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting || isSameStorageClass || !hasSelectedStorageClass}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle size={16} strokeWidth={2} className="restore-submit-spinner" />
                  <span>
                    {t(
                      isAws
                        ? "content.storage_class_change.submitting"
                        : "content.azure_storage_class_change.submitting"
                    )}
                  </span>
                </>
              ) : (
                t("navigation.menu.change_tier")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
