import { AzureRehydrationRequestPanel } from "../azure-restore/AzureRehydrationRequestPanel";
import { AwsRestoreRequestPanel } from "../aws-restore/AwsRestoreRequestPanel";
import type { ConnectionProvider } from "../connections/models";
import type { Locale } from "../../lib/i18n/I18nProvider";
import type { AwsRestoreTier } from "../../lib/tauri/awsConnections";
import type { AzureRehydrationPriority } from "../../lib/tauri/azureConnections";
import type { AzureUploadTier } from "../connections/azureUploadTiers";

export type RestoreRequestTarget = {
  provider: ConnectionProvider;
  fileName: string;
  fileSizeLabel: string;
  storageClass?: string | null;
};

export type RestoreRequestSummary = {
  provider: ConnectionProvider;
  fileCount: number;
  totalSizeLabel?: string | null;
  storageClassLabel?: string | null;
  storageClasses?: Array<string | null | undefined>;
};

type RestoreRequestModalProps = {
  locale: Locale;
  request: RestoreRequestTarget | RestoreRequestSummary;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmitAwsRequest: (input: { tier: AwsRestoreTier; days: number }) => void;
  onSubmitAzureRequest: (input: {
    targetTier: Exclude<AzureUploadTier, "Archive">;
    priority: AzureRehydrationPriority;
  }) => void;
  t: (key: string) => string;
};

export function RestoreRequestModal({
  locale,
  request,
  isSubmitting,
  submitError,
  onCancel,
  onSubmitAwsRequest,
  onSubmitAzureRequest,
  t
}: RestoreRequestModalProps) {
  const isBatchRequest = "fileCount" in request;
  const title =
    request.provider === "aws"
      ? isBatchRequest
        ? t("restore.modal.aws.title_batch").replace("{count}", String(request.fileCount))
        : `${t("restore.modal.aws.title")}: ${request.fileName}`
      : request.provider === "azure"
      ? isBatchRequest
        ? t("restore.modal.azure.title_batch").replace("{count}", String(request.fileCount))
        : `${t("restore.modal.azure.title")}: ${request.fileName}`
      : isBatchRequest
      ? t("restore.modal.generic.title_batch").replace("{count}", String(request.fileCount))
      : `${t("restore.modal.generic.title")}: ${request.fileName}`;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card restore-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-request-modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">
              {request.provider === "aws"
                ? t("restore.modal.aws.eyebrow")
                : request.provider === "azure"
                ? t("restore.modal.azure.eyebrow")
                : t("restore.modal.generic.eyebrow")}
            </p>
            <h2 id="restore-request-modal-title" className="modal-title">
              {title}
            </h2>
            <p className="restore-modal-header-meta">
              {isBatchRequest ? (
                <>
                  <span>
                    {t("restore.modal.batch.count").replace("{count}", String(request.fileCount))}
                  </span>
                  {request.totalSizeLabel ? <span>{request.totalSizeLabel}</span> : null}
                  {request.storageClassLabel ? <span>{request.storageClassLabel}</span> : null}
                </>
              ) : (
                <>
                  <span>{request.fileSizeLabel}</span>
                  {request.storageClass ? <span>{request.storageClass}</span> : null}
                </>
              )}
            </p>
          </div>
        </div>

        {request.provider === "aws" ? (
          <AwsRestoreRequestPanel
            locale={locale}
            storageClass={isBatchRequest ? undefined : request.storageClass}
            storageClasses={isBatchRequest ? request.storageClasses : undefined}
            fileCount={isBatchRequest ? request.fileCount : 1}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onCancel={onCancel}
            onSubmit={onSubmitAwsRequest}
            t={t}
          />
        ) : request.provider === "azure" ? (
          <AzureRehydrationRequestPanel
            locale={locale}
            fileCount={isBatchRequest ? request.fileCount : 1}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onCancel={onCancel}
            onSubmit={onSubmitAzureRequest}
            t={t}
          />
        ) : (
          <>
            <p className="modal-copy">{t("restore.modal.generic.placeholder")}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onCancel}>
                {t("common.close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
