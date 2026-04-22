import { AlertCircle, CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import type { Locale } from "../../../lib/i18n/I18nProvider";
import type { AwsUploadStorageClass } from "../../connections/awsUploadStorageClasses";
import type { AzureUploadTier } from "../../connections/azureUploadTiers";
import { AwsConnectionFields } from "../../connections/components/AwsConnectionFields";
import { AzureConnectionFields } from "../../connections/components/AzureConnectionFields";
import type {
  AzureAuthenticationMethod,
  ConnectionFormMode,
  ConnectionProvider
} from "../../connections/models";
import type { ConnectionTestStatus } from "../hooks/useConnectionFormState";
import type { NavigationFormErrors } from "../navigationValidation";

export type ConnectionFormModalFieldIds = {
  nameFieldId: string;
  providerFieldId: string;
  accessKeyFieldId: string;
  secretKeyFieldId: string;
  restrictedBucketNameFieldId: string;
  storageAccountNameFieldId: string;
  azureAuthenticationMethodFieldId: string;
  azureAccountKeyFieldId: string;
  connectOnStartupFieldId: string;
};

export type ConnectionFormModalProps = {
  isOpen: boolean;
  locale: Locale;
  fieldIds: ConnectionFormModalFieldIds;
  modalMode: ConnectionFormMode;
  connectionName: string;
  connectionProvider: ConnectionProvider;
  accessKeyId: string;
  secretAccessKey: string;
  restrictedBucketName: string;
  storageAccountName: string;
  azureAuthenticationMethod: AzureAuthenticationMethod;
  azureAccountKey: string;
  connectOnStartup: boolean;
  defaultAwsUploadStorageClass: AwsUploadStorageClass;
  defaultAzureUploadTier: AzureUploadTier;
  formErrors: NavigationFormErrors;
  submitError: string | null;
  isSubmitting: boolean;
  connectionTestStatus: ConnectionTestStatus;
  connectionTestMessage: string | null;
  t: (key: string) => string;
  onConnectionNameChange: (value: string) => void;
  onConnectionProviderChange: (value: ConnectionProvider) => void;
  onAccessKeyIdChange: (value: string) => void;
  onSecretAccessKeyChange: (value: string) => void;
  onRestrictedBucketNameChange: (value: string) => void;
  onStorageAccountNameChange: (value: string) => void;
  onAzureAuthenticationMethodChange: (value: AzureAuthenticationMethod) => void;
  onAzureAccountKeyChange: (value: string) => void;
  onConnectOnStartupChange: (value: boolean) => void;
  onDefaultAwsUploadStorageClassChange: (value: AwsUploadStorageClass) => void;
  onDefaultAzureUploadTierChange: (value: AzureUploadTier) => void;
  onTestConnection: () => void;
  onSaveConnection: () => void;
  onClose: () => void;
};

export function ConnectionFormModal({
  isOpen,
  locale,
  fieldIds,
  modalMode,
  connectionName,
  connectionProvider,
  accessKeyId,
  secretAccessKey,
  restrictedBucketName,
  storageAccountName,
  azureAuthenticationMethod,
  azureAccountKey,
  connectOnStartup,
  defaultAwsUploadStorageClass,
  defaultAzureUploadTier,
  formErrors,
  submitError,
  isSubmitting,
  connectionTestStatus,
  connectionTestMessage,
  t,
  onConnectionNameChange,
  onConnectionProviderChange,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  onRestrictedBucketNameChange,
  onStorageAccountNameChange,
  onAzureAuthenticationMethodChange,
  onAzureAccountKeyChange,
  onConnectOnStartupChange,
  onDefaultAwsUploadStorageClassChange,
  onDefaultAzureUploadTierChange,
  onTestConnection,
  onSaveConnection,
  onClose
}: ConnectionFormModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card modal-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">
              {modalMode === "edit"
                ? t("navigation.modal.edit_eyebrow")
                : t("navigation.modal.eyebrow")}
            </p>
            <h2 id="connection-modal-title" className="modal-title">
              {modalMode === "edit" ? t("navigation.modal.edit_title") : t("navigation.modal.title")}
            </h2>
          </div>
        </div>

        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveConnection();
          }}
        >
          <div className="modal-scroll-panel">
            <div className="modal-scroll-viewport">
              <label className="field-group" htmlFor={fieldIds.nameFieldId}>
                <span>{t("navigation.modal.name_label")}</span>
                <input
                  id={fieldIds.nameFieldId}
                  type="text"
                  value={connectionName}
                  placeholder={t("navigation.modal.name_placeholder")}
                  onChange={(event) => onConnectionNameChange(event.target.value)}
                  autoFocus
                />
                {formErrors.connectionName ? (
                  <span className="field-error">{formErrors.connectionName}</span>
                ) : null}
              </label>

              <label className="field-group" htmlFor={fieldIds.providerFieldId}>
                <span>{t("navigation.modal.type_label")}</span>
                <select
                  id={fieldIds.providerFieldId}
                  value={connectionProvider}
                  disabled={modalMode === "edit"}
                  onChange={(event) => onConnectionProviderChange(event.target.value as ConnectionProvider)}
                >
                  <option value="aws">{t("content.provider.aws")}</option>
                  <option value="azure">{t("content.provider.azure")}</option>
                </select>
              </label>

              {connectionProvider === "aws" ? (
                <AwsConnectionFields
                  locale={locale}
                  accessKeyFieldId={fieldIds.accessKeyFieldId}
                  secretKeyFieldId={fieldIds.secretKeyFieldId}
                  restrictedBucketNameFieldId={fieldIds.restrictedBucketNameFieldId}
                  connectOnStartupFieldId={fieldIds.connectOnStartupFieldId}
                  accessKeyId={accessKeyId}
                  secretAccessKey={secretAccessKey}
                  restrictedBucketName={restrictedBucketName}
                  connectOnStartup={connectOnStartup}
                  defaultUploadStorageClass={defaultAwsUploadStorageClass}
                  errors={{
                    accessKeyId: formErrors.accessKeyId,
                    secretAccessKey: formErrors.secretAccessKey,
                    restrictedBucketName: formErrors.restrictedBucketName
                  }}
                  onAccessKeyIdChange={onAccessKeyIdChange}
                  onSecretAccessKeyChange={onSecretAccessKeyChange}
                  onRestrictedBucketNameChange={onRestrictedBucketNameChange}
                  onConnectOnStartupChange={onConnectOnStartupChange}
                  onDefaultUploadStorageClassChange={onDefaultAwsUploadStorageClassChange}
                  t={t}
                />
              ) : (
                <AzureConnectionFields
                  storageAccountNameFieldId={fieldIds.storageAccountNameFieldId}
                  authenticationMethodFieldId={fieldIds.azureAuthenticationMethodFieldId}
                  accountKeyFieldId={fieldIds.azureAccountKeyFieldId}
                  connectOnStartupFieldId={fieldIds.connectOnStartupFieldId}
                  storageAccountName={storageAccountName}
                  authenticationMethod={azureAuthenticationMethod}
                  accountKey={azureAccountKey}
                  connectOnStartup={connectOnStartup}
                  defaultUploadTier={defaultAzureUploadTier}
                  errors={{
                    storageAccountName: formErrors.storageAccountName,
                    authenticationMethod: formErrors.authenticationMethod,
                    accountKey: formErrors.accountKey
                  }}
                  onStorageAccountNameChange={onStorageAccountNameChange}
                  onAuthenticationMethodChange={onAzureAuthenticationMethodChange}
                  onAccountKeyChange={onAzureAccountKeyChange}
                  onConnectOnStartupChange={onConnectOnStartupChange}
                  onDefaultUploadTierChange={onDefaultAzureUploadTierChange}
                  t={t}
                />
              )}

              {submitError ? <p className="status-message-error">{submitError}</p> : null}
            </div>
          </div>

          <div className="connection-modal-footer">
            <div className="connection-test-footer">
              <button
                type="button"
                className="secondary-button"
                disabled={isSubmitting || connectionTestStatus === "testing"}
                onClick={onTestConnection}
                title={t(
                  connectionProvider === "aws"
                    ? "navigation.modal.aws.test_connection_helper"
                    : "navigation.modal.azure.test_connection_helper"
                )}
              >
                {t(
                  connectionProvider === "aws"
                    ? "navigation.modal.aws.test_connection_button"
                    : "navigation.modal.azure.test_connection_button"
                )}
              </button>

              {connectionTestStatus !== "idle" ? (
                <ConnectionTestStatusIcon
                  provider={connectionProvider}
                  status={connectionTestStatus}
                  message={connectionTestMessage}
                  t={t}
                />
              ) : null}
            </div>

            <div className="modal-actions modal-actions-inline">
              <button type="button" className="secondary-button" onClick={onClose}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {modalMode === "edit" ? t("common.update") : t("common.save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConnectionTestStatusIcon({
  provider,
  status,
  message,
  t
}: {
  provider: ConnectionProvider;
  status: ConnectionTestStatus;
  message: string | null;
  t: (key: string) => string;
}) {
  const label = `${t(`navigation.modal.${provider}.test_connection_status.${status}`)}${
    message ? `: ${message}` : ""
  }`;

  return (
    <span className={`connection-test-status-icon is-${status}`} title={label} aria-label={label}>
      {status === "success" ? (
        <CheckCircle2 size={16} strokeWidth={2} />
      ) : status === "error" ? (
        <XCircle size={16} strokeWidth={2} />
      ) : status === "testing" ? (
        <LoaderCircle size={16} strokeWidth={2} className="connection-test-spinner" />
      ) : (
        <AlertCircle size={16} strokeWidth={2} />
      )}
    </span>
  );
}
