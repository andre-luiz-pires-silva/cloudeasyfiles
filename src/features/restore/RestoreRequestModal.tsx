import { AwsRestoreRequestPanel } from "../aws-restore/AwsRestoreRequestPanel";
import type { ConnectionProvider } from "../connections/models";
import type { AwsRestoreTier } from "../../lib/tauri/awsConnections";

export type RestoreRequestTarget = {
  provider: ConnectionProvider;
  fileName: string;
  fileSizeLabel: string;
  storageClass?: string | null;
};

type RestoreRequestModalProps = {
  request: RestoreRequestTarget;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmitAwsRequest: (input: { tier: AwsRestoreTier; days: number }) => void;
  t: (key: string) => string;
};

export function RestoreRequestModal({
  request,
  isSubmitting,
  submitError,
  onCancel,
  onSubmitAwsRequest,
  t
}: RestoreRequestModalProps) {
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
                : t("restore.modal.generic.eyebrow")}
            </p>
            <h2 id="restore-request-modal-title" className="modal-title">
              {request.provider === "aws"
                ? `${t("restore.modal.aws.title")}: ${request.fileName}`
                : `${t("restore.modal.generic.title")}: ${request.fileName}`}
            </h2>
            <p className="restore-modal-header-meta">
              <span>{request.fileSizeLabel}</span>
              {request.storageClass ? <span>{request.storageClass}</span> : null}
            </p>
          </div>
        </div>

        {request.provider === "aws" ? (
          <AwsRestoreRequestPanel
            storageClass={request.storageClass}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onCancel={onCancel}
            onSubmit={onSubmitAwsRequest}
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
