import { LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { Locale } from "../../lib/i18n/I18nProvider";
import type { AwsUploadStorageClass } from "../connections/awsUploadStorageClasses";
import { normalizeAwsUploadStorageClass } from "../connections/awsUploadStorageClasses";
import { AwsStorageClassSelector } from "../connections/components/AwsStorageClassSelector";
import { getAwsChangeTierContent } from "../aws/awsProviderContent";

export type ChangeStorageClassRequestSummary = {
  fileCount: number;
  totalSizeLabel?: string | null;
  currentStorageClassLabel?: string | null;
};

type ChangeStorageClassModalProps = {
  locale: Locale;
  request: ChangeStorageClassRequestSummary;
  initialStorageClass?: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (storageClass: AwsUploadStorageClass) => void;
  t: (key: string) => string;
};

export function ChangeStorageClassModal({
  locale,
  request,
  initialStorageClass,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
  t
}: ChangeStorageClassModalProps) {
  const content = getAwsChangeTierContent(t);
  const normalizedInitialStorageClass = initialStorageClass
    ? normalizeAwsUploadStorageClass(initialStorageClass)
    : null;
  const [selectedStorageClass, setSelectedStorageClass] = useState<AwsUploadStorageClass | null>(
    normalizedInitialStorageClass
  );
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
      t("content.storage_class_change.confirmation_summary")
        .replace("{count}", String(request.fileCount))
        .replace(
          "{storageClass}",
          selectedStorageClass ?? t("content.storage_class_change.choose_destination_placeholder")
        ),
    [request.fileCount, selectedStorageClass, t]
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
            <p className="modal-eyebrow">{t("content.storage_class_change.eyebrow")}</p>
            <h2 id="change-storage-class-modal-title" className="modal-title">
              {title}
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
            <p className="modal-copy">{t("content.storage_class_change.intro")}</p>
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
              <AwsStorageClassSelector
                value={selectedStorageClass}
                onChange={setSelectedStorageClass}
                content={content}
                name="aws-change-storage-class"
              />

              <div className="restore-modal-section restore-modal-confirmation">
                <strong>{t("restore.modal.confirmation_title")}</strong>
                <p>{confirmationSummary}</p>
                <p>{t("content.storage_class_change.confirmation_warning")}</p>
              </div>

              {isSameStorageClass ? (
                <p className="status-message-error">
                  {t("content.storage_class_change.same_class_error")}
                </p>
              ) : null}

              {requiresExplicitSelection && !hasSelectedStorageClass ? (
                <p className="status-message-error">
                  {t("content.storage_class_change.choose_destination_error")}
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
                  <span>{t("content.storage_class_change.submitting")}</span>
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
