import { File, Folder, X } from "lucide-react";
import type { Locale } from "../../../lib/i18n/I18nProvider";
import type { AwsRestoreTier } from "../../../lib/tauri/awsConnections";
import type { AzureRehydrationPriority } from "../../../lib/tauri/azureConnections";
import type { AwsUploadStorageClass } from "../../connections/awsUploadStorageClasses";
import type { AzureUploadTier } from "../../connections/azureUploadTiers";
import { AwsUploadStorageClassField } from "../../connections/components/AwsUploadStorageClassField";
import { AzureUploadTierField } from "../../connections/components/AzureUploadTierField";
import type { ConnectionProvider, SavedConnectionSummary } from "../../connections/models";
import { RestoreRequestModal } from "../../restore/RestoreRequestModal";
import { ChangeStorageClassModal } from "../../storage-class/ChangeStorageClassModal";
import { ConnectionFormModal, type ConnectionFormModalProps } from "./ConnectionFormModal";
import type { NavigationPendingDeleteState } from "../navigationTypes";
import type {
  NavigationActiveTransfer,
  NavigationCompletionToast,
  NavigationTransferKind
} from "../navigationTransfers";
import type { UploadConflictDecision, UploadConflictPromptState } from "../navigationUploads";
import type {
  NavigationChangeStorageClassRequestState,
  NavigationRestoreRequestState
} from "../navigationWorkflows";
import { formatBytes } from "../navigationPresentation";
import { getTransferCancelLabel } from "../navigationTreeState";

export type NavigatorModalOrchestratorProps = {
  locale: Locale;
  t: (key: string) => string;
  restoreRequest: NavigationRestoreRequestState | null;
  restoreSubmitError: string | null;
  isSubmittingRestoreRequest: boolean;
  onCloseRestoreRequestModal: () => void;
  onSubmitAwsRestoreRequest: (input: { tier: AwsRestoreTier; days: number }) => void;
  onSubmitAzureRehydrationRequest: (input: {
    targetTier: Exclude<AzureUploadTier, "Archive">;
    priority: AzureRehydrationPriority;
  }) => void;
  changeStorageClassRequest: NavigationChangeStorageClassRequestState | null;
  changeStorageClassSubmitError: string | null;
  isSubmittingStorageClassChange: boolean;
  onCloseChangeStorageClassModal: () => void;
  onSubmitChangeStorageClass: (storageClass: AwsUploadStorageClass | AzureUploadTier) => void;
  isTransferModalOpen: boolean;
  activeTransferList: NavigationActiveTransfer[];
  onCancelActiveTransfer: (operationId: string, transferKind: NavigationTransferKind) => void;
  onCloseTransferModal: () => void;
  completionToast: NavigationCompletionToast | null;
  onCloseCompletionToast: () => void;
  connectionFormProps: ConnectionFormModalProps;
  isUploadSettingsModalOpen: boolean;
  selectedConnection: SavedConnectionSummary | null;
  uploadSettingsStorageClass: AwsUploadStorageClass;
  uploadSettingsAzureTier: AzureUploadTier;
  uploadSettingsSubmitError: string | null;
  isSavingUploadSettings: boolean;
  onUploadSettingsStorageClassChange: (value: AwsUploadStorageClass) => void;
  onUploadSettingsAzureTierChange: (value: AzureUploadTier) => void;
  onSaveUploadSettings: () => void;
  onCloseUploadSettingsModal: () => void;
  isCreateFolderModalOpen: boolean;
  canCreateFolderInCurrentContext: boolean;
  newFolderNameFieldId: string;
  newFolderName: string;
  createFolderError: string | null;
  isCreatingFolder: boolean;
  selectedBucketProvider: ConnectionProvider | null;
  selectedBucketName: string | null;
  selectedBucketPath: string;
  onNewFolderNameChange: (value: string) => void;
  onClearCreateFolderError: () => void;
  onCreateFolder: () => void;
  onCloseCreateFolderModal: () => void;
  pendingContentDelete: NavigationPendingDeleteState | null;
  deleteConfirmationValue: string;
  deleteContentError: string | null;
  isDeletingContent: boolean;
  contentDeleteConfirmationText: string;
  onDeleteConfirmationValueChange: (value: string) => void;
  onClearDeleteContentError: () => void;
  onCloseDeleteContentModal: () => void;
  onConfirmDeleteContent: () => void;
  pendingDeleteConnection: SavedConnectionSummary | null;
  onCancelDeleteConnection: () => void;
  onConfirmDeleteConnection: () => void;
  uploadConflictPrompt: UploadConflictPromptState | null;
  onResolveUploadConflict: (decision: UploadConflictDecision) => void;
};

export function NavigatorModalOrchestrator({
  locale,
  t,
  restoreRequest,
  restoreSubmitError,
  isSubmittingRestoreRequest,
  onCloseRestoreRequestModal,
  onSubmitAwsRestoreRequest,
  onSubmitAzureRehydrationRequest,
  changeStorageClassRequest,
  changeStorageClassSubmitError,
  isSubmittingStorageClassChange,
  onCloseChangeStorageClassModal,
  onSubmitChangeStorageClass,
  isTransferModalOpen,
  activeTransferList,
  onCancelActiveTransfer,
  onCloseTransferModal,
  completionToast,
  onCloseCompletionToast,
  connectionFormProps,
  isUploadSettingsModalOpen,
  selectedConnection,
  uploadSettingsStorageClass,
  uploadSettingsAzureTier,
  uploadSettingsSubmitError,
  isSavingUploadSettings,
  onUploadSettingsStorageClassChange,
  onUploadSettingsAzureTierChange,
  onSaveUploadSettings,
  onCloseUploadSettingsModal,
  isCreateFolderModalOpen,
  canCreateFolderInCurrentContext,
  newFolderNameFieldId,
  newFolderName,
  createFolderError,
  isCreatingFolder,
  selectedBucketProvider,
  selectedBucketName,
  selectedBucketPath,
  onNewFolderNameChange,
  onClearCreateFolderError,
  onCreateFolder,
  onCloseCreateFolderModal,
  pendingContentDelete,
  deleteConfirmationValue,
  deleteContentError,
  isDeletingContent,
  contentDeleteConfirmationText,
  onDeleteConfirmationValueChange,
  onClearDeleteContentError,
  onCloseDeleteContentModal,
  onConfirmDeleteContent,
  pendingDeleteConnection,
  onCancelDeleteConnection,
  onConfirmDeleteConnection,
  uploadConflictPrompt,
  onResolveUploadConflict
}: NavigatorModalOrchestratorProps) {
  return (
    <>
      {restoreRequest ? (
        <RestoreRequestModal
          locale={locale}
          request={restoreRequest.request}
          isSubmitting={isSubmittingRestoreRequest}
          submitError={restoreSubmitError}
          onCancel={onCloseRestoreRequestModal}
          onSubmitAwsRequest={onSubmitAwsRestoreRequest}
          onSubmitAzureRequest={onSubmitAzureRehydrationRequest}
          t={t}
        />
      ) : null}

      {changeStorageClassRequest ? (
        <ChangeStorageClassModal
          provider={changeStorageClassRequest.provider}
          locale={locale}
          request={changeStorageClassRequest.request}
          initialStorageClass={changeStorageClassRequest.currentStorageClass}
          isSubmitting={isSubmittingStorageClassChange}
          submitError={changeStorageClassSubmitError}
          onCancel={onCloseChangeStorageClassModal}
          onSubmit={onSubmitChangeStorageClass}
          t={t}
        />
      ) : null}

      {isTransferModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-summary-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.transfer.modal_eyebrow")}</p>
                <h2 id="transfer-summary-modal-title" className="modal-title">
                  {t("content.transfer.modal_title")}
                </h2>
              </div>
            </div>

            <div className="transfer-modal-list">
              {activeTransferList.length === 0 ? (
                <p className="modal-copy">{t("content.transfer.modal_empty")}</p>
              ) : (
                activeTransferList.map((transfer) => (
                  <article key={transfer.operationId} className="transfer-modal-item">
                    <div className="transfer-modal-item-header">
                      <strong>{transfer.fileName}</strong>
                      <span>{Math.max(0, Math.min(100, Math.round(transfer.progressPercent)))}%</span>
                    </div>
                    <p className="transfer-modal-item-copy">
                      {transfer.transferKind === "direct"
                        ? t("content.transfer.direct_download_label")
                        : transfer.transferKind === "upload"
                          ? t("content.transfer.simple_upload_label")
                          : t("content.transfer.tracked_download_label")}
                      {" · "}
                      {transfer.bucketName}
                    </p>
                    {transfer.transferKind === "direct" && transfer.targetPath ? (
                      <p className="transfer-modal-item-copy transfer-modal-item-copy-secondary">
                        {transfer.targetPath}
                      </p>
                    ) : null}
                    {transfer.transferKind === "upload" && transfer.objectKey ? (
                      <p className="transfer-modal-item-copy transfer-modal-item-copy-secondary">
                        {transfer.objectKey}
                      </p>
                    ) : null}
                    <div className="transfer-progress">
                      <span
                        className="transfer-progress-bar"
                        style={{
                          width: `${Math.max(4, Math.min(100, transfer.progressPercent || 4))}%`
                        }}
                      />
                    </div>
                    <p className="transfer-modal-item-meta">
                      {formatBytes(transfer.bytesTransferred, locale)} /{" "}
                      {transfer.totalBytes > 0
                        ? formatBytes(transfer.totalBytes, locale)
                        : t("content.transfer.size_unknown")}
                    </p>
                    <div className="transfer-modal-item-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          onCancelActiveTransfer(transfer.operationId, transfer.transferKind)
                        }
                      >
                        {getTransferCancelLabel(transfer.transferKind, t)}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onCloseTransferModal}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {completionToast ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          <article className={`toast-card${completionToast.tone === "error" ? " is-error" : ""}`}>
            <div className="toast-card-copy">
              <strong>{completionToast.title}</strong>
              <p>{completionToast.description}</p>
            </div>
            <button
              type="button"
              className="toast-card-close"
              onClick={onCloseCompletionToast}
              aria-label={t("common.close")}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </article>
        </div>
      ) : null}

      <ConnectionFormModal {...connectionFormProps} />

      {isUploadSettingsModalOpen && selectedConnection ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-settings-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.transfer.upload_settings_eyebrow")}</p>
                <h2 id="upload-settings-modal-title" className="modal-title">
                  {t("content.transfer.upload_settings_title").replace(
                    "{name}",
                    selectedConnection.name
                  )}
                </h2>
              </div>
            </div>

            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSaveUploadSettings();
              }}
            >
              <div className="modal-scroll-panel">
                <div className="modal-scroll-viewport">
                  {selectedConnection.provider === "aws" ? (
                    <AwsUploadStorageClassField
                      locale={locale}
                      value={uploadSettingsStorageClass}
                      onChange={onUploadSettingsStorageClassChange}
                    />
                  ) : (
                    <AzureUploadTierField
                      value={uploadSettingsAzureTier}
                      onChange={onUploadSettingsAzureTierChange}
                    />
                  )}

                  {uploadSettingsSubmitError ? (
                    <p className="status-message-error">{uploadSettingsSubmitError}</p>
                  ) : null}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onCloseUploadSettingsModal}
                >
                  {t("common.cancel")}
                </button>
                <button type="submit" className="primary-button" disabled={isSavingUploadSettings}>
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateFolderModalOpen && canCreateFolderInCurrentContext ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-folder-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.folder.create_eyebrow")}</p>
                <h2 id="create-folder-modal-title" className="modal-title">
                  {t("content.folder.create_title")}
                </h2>
              </div>
            </div>

            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                onCreateFolder();
              }}
            >
              <label className="field-group" htmlFor={newFolderNameFieldId}>
                <span>{t("content.folder.name_label")}</span>
                <input
                  id={newFolderNameFieldId}
                  type="text"
                  value={newFolderName}
                  placeholder={t("content.folder.name_placeholder")}
                  onChange={(event) => {
                    onNewFolderNameChange(event.target.value);
                    if (createFolderError) {
                      onClearCreateFolderError();
                    }
                  }}
                  autoFocus
                />
                <span className="field-helper">
                  {t("content.folder.name_helper").replace(
                    "{path}",
                    [
                      selectedBucketProvider?.toUpperCase() ?? t("content.provider.aws"),
                      selectedBucketName ?? "",
                      selectedBucketPath
                    ]
                      .filter((segment) => segment.length > 0)
                      .join("/")
                  )}
                </span>
              </label>

              {createFolderError ? (
                <p className="status-message-error">{createFolderError}</p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onCloseCreateFolderModal}
                  disabled={isCreatingFolder}
                >
                  {t("common.cancel")}
                </button>
                <button type="submit" className="primary-button" disabled={isCreatingFolder}>
                  {isCreatingFolder
                    ? t("content.folder.creating_button")
                    : t("content.folder.create_button")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingContentDelete ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-content-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.delete.eyebrow")}</p>
                <h2 id="delete-content-modal-title" className="modal-title">
                  {pendingContentDelete.items.length === 1
                    ? t(
                        pendingContentDelete.directoryCount === 1
                          ? "content.delete.title_single_folder"
                          : "content.delete.title_single_file"
                      ).replace("{name}", pendingContentDelete.items[0]?.name ?? "")
                    : t("content.delete.title_batch").replace(
                        "{count}",
                        String(pendingContentDelete.items.length)
                      )}
                </h2>
              </div>
            </div>

            <div className="modal-scroll-panel">
              <div className="modal-scroll-viewport">
                <p className="modal-copy">
                  {pendingContentDelete.directoryCount > 0
                    ? t("content.delete.description_recursive")
                        .replace("{files}", String(pendingContentDelete.fileCount))
                        .replace("{folders}", String(pendingContentDelete.directoryCount))
                    : t("content.delete.description_files").replace(
                        "{count}",
                        String(pendingContentDelete.fileCount)
                      )}
                </p>
                <p className="modal-copy">
                  {t("content.delete.confirmation_instruction").replace(
                    "{value}",
                    contentDeleteConfirmationText
                  )}
                </p>
                <label className="field-group" htmlFor="delete-content-confirmation-input">
                  <span>{t("content.delete.confirmation_label")}</span>
                  <input
                    id="delete-content-confirmation-input"
                    type="text"
                    value={deleteConfirmationValue}
                    onChange={(event) => {
                      onDeleteConfirmationValueChange(event.target.value);
                      if (deleteContentError) {
                        onClearDeleteContentError();
                      }
                    }}
                    autoFocus
                  />
                </label>

                <div className="content-delete-summary">
                  <span>
                    <File size={14} strokeWidth={1.9} />
                    {t("content.delete.summary_files").replace(
                      "{count}",
                      String(pendingContentDelete.fileCount)
                    )}
                  </span>
                  <span>
                    <Folder size={14} strokeWidth={1.9} />
                    {t("content.delete.summary_folders").replace(
                      "{count}",
                      String(pendingContentDelete.directoryCount)
                    )}
                  </span>
                </div>

                {deleteContentError ? (
                  <p className="status-message-error">{deleteContentError}</p>
                ) : null}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onCloseDeleteContentModal}
                disabled={isDeletingContent}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="secondary-button secondary-button-danger"
                onClick={onConfirmDeleteContent}
                disabled={
                  isDeletingContent ||
                  deleteConfirmationValue.trim() !== contentDeleteConfirmationText
                }
              >
                {isDeletingContent ? t("content.delete.deleting") : t("content.delete.action")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteConnection ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-connection-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("navigation.connections.delete_title")}</p>
                <h2 id="delete-connection-modal-title" className="modal-title">
                  {t("navigation.connections.delete_confirm").replace(
                    "{name}",
                    pendingDeleteConnection.name
                  )}
                </h2>
              </div>
            </div>

            <p className="modal-copy">
              {t("navigation.connections.delete_description")
                .replace("{name}", pendingDeleteConnection.name)
                .replace("{provider}", t(`content.provider.${pendingDeleteConnection.provider}`))}
            </p>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onCancelDeleteConnection}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="secondary-button secondary-button-danger"
                onClick={onConfirmDeleteConnection}
              >
                {t("navigation.menu.remove")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uploadConflictPrompt ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-conflict-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.transfer.conflict_modal_eyebrow")}</p>
                <h2 id="upload-conflict-modal-title" className="modal-title">
                  {t("content.transfer.conflict_modal_title").replace(
                    "{name}",
                    uploadConflictPrompt.fileName
                  )}
                </h2>
              </div>
            </div>

            <p className="modal-copy">
              {t("content.transfer.conflict_modal_progress")
                .replace("{current}", String(uploadConflictPrompt.currentConflictIndex))
                .replace("{total}", String(uploadConflictPrompt.totalConflicts))}
            </p>
            <p className="modal-copy">{t("content.transfer.conflict_modal_body")}</p>
            <p className="modal-copy">
              <strong>{t("content.transfer.conflict_modal_destination_label")}:</strong>{" "}
              {uploadConflictPrompt.objectKey}
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => onResolveUploadConflict("skip")}
              >
                {t("content.transfer.conflict_skip")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onResolveUploadConflict("skipAll")}
              >
                {t("content.transfer.conflict_skip_all")}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => onResolveUploadConflict("overwrite")}
              >
                {t("content.transfer.conflict_replace")}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => onResolveUploadConflict("overwriteAll")}
              >
                {t("content.transfer.conflict_replace_all")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
