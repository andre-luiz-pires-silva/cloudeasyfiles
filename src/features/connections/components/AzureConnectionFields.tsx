import type { AzureAuthenticationMethod } from "../models";
import type { AzureUploadTier } from "../azureUploadTiers";
import { AzureUploadTierField } from "./AzureUploadTierField";

type AzureConnectionFieldsProps = {
  storageAccountNameFieldId: string;
  authenticationMethodFieldId: string;
  accountKeyFieldId: string;
  connectOnStartupFieldId: string;
  storageAccountName: string;
  authenticationMethod: AzureAuthenticationMethod;
  accountKey: string;
  connectOnStartup: boolean;
  defaultUploadTier: AzureUploadTier;
  errors: Partial<
    Record<"storageAccountName" | "authenticationMethod" | "accountKey", string>
  >;
  onStorageAccountNameChange: (value: string) => void;
  onAuthenticationMethodChange: (value: AzureAuthenticationMethod) => void;
  onAccountKeyChange: (value: string) => void;
  onConnectOnStartupChange: (value: boolean) => void;
  onDefaultUploadTierChange: (value: AzureUploadTier) => void;
  t: (key: string) => string;
};

export function AzureConnectionFields({
  storageAccountNameFieldId,
  authenticationMethodFieldId,
  accountKeyFieldId,
  connectOnStartupFieldId,
  storageAccountName,
  authenticationMethod,
  accountKey,
  connectOnStartup,
  defaultUploadTier,
  errors,
  onStorageAccountNameChange,
  onAuthenticationMethodChange,
  onAccountKeyChange,
  onConnectOnStartupChange,
  onDefaultUploadTierChange,
  t
}: AzureConnectionFieldsProps) {
  return (
    <>
      <label className="field-group" htmlFor={storageAccountNameFieldId}>
        <span>{t("navigation.modal.azure.storage_account_label")}</span>
        <input
          id={storageAccountNameFieldId}
          type="text"
          value={storageAccountName}
          placeholder={t("navigation.modal.azure.storage_account_placeholder")}
          onChange={(event) => onStorageAccountNameChange(event.target.value)}
        />
        <span className="field-helper">{t("navigation.modal.azure.storage_account_helper")}</span>
        {errors.storageAccountName ? (
          <span className="field-error">{errors.storageAccountName}</span>
        ) : null}
      </label>

      <label className="field-group" htmlFor={authenticationMethodFieldId}>
        <span>{t("navigation.modal.azure.authentication_method_label")}</span>
        <select
          id={authenticationMethodFieldId}
          value={authenticationMethod}
          onChange={(event) =>
            onAuthenticationMethodChange(event.target.value as AzureAuthenticationMethod)
          }
        >
          <option value="shared_key">
            {t("navigation.modal.azure.authentication_method.shared_key")}
          </option>
          <option value="entra_id" disabled>
            {t("navigation.modal.azure.authentication_method.entra_id")}
          </option>
        </select>
        {errors.authenticationMethod ? (
          <span className="field-error">{errors.authenticationMethod}</span>
        ) : null}
      </label>

      <label className="field-group" htmlFor={accountKeyFieldId}>
        <span>{t("navigation.modal.azure.account_key_label")}</span>
        <input
          id={accountKeyFieldId}
          type="password"
          value={accountKey}
          placeholder={t("navigation.modal.azure.account_key_placeholder")}
          onChange={(event) => onAccountKeyChange(event.target.value)}
        />
        {errors.accountKey ? <span className="field-error">{errors.accountKey}</span> : null}
      </label>

      <label className="field-group field-group-checkbox" htmlFor={connectOnStartupFieldId}>
        <span className="checkbox-setting-row">
          <input
            id={connectOnStartupFieldId}
            type="checkbox"
            checked={connectOnStartup}
            onChange={(event) => onConnectOnStartupChange(event.target.checked)}
          />
          <span className="checkbox-setting-copy">
            <span className="checkbox-setting-title">
              {t("navigation.modal.azure.connect_on_startup_label")}
            </span>
            <span className="field-helper">
              {t("navigation.modal.azure.connect_on_startup_helper")}
            </span>
          </span>
        </span>
      </label>

      <AzureUploadTierField value={defaultUploadTier} onChange={onDefaultUploadTierChange} />
    </>
  );
}
