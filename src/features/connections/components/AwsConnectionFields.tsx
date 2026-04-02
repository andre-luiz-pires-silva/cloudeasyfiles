import type { Locale } from "../../../lib/i18n/I18nProvider";
import { type AwsUploadStorageClass } from "../awsUploadStorageClasses";
import { AwsUploadStorageClassField } from "./AwsUploadStorageClassField";

type AwsConnectionFieldsProps = {
  locale: Locale;
  accessKeyFieldId: string;
  secretKeyFieldId: string;
  accessKeyId: string;
  secretAccessKey: string;
  defaultUploadStorageClass: AwsUploadStorageClass;
  errors: Partial<Record<"accessKeyId" | "secretAccessKey", string>>;
  onAccessKeyIdChange: (value: string) => void;
  onSecretAccessKeyChange: (value: string) => void;
  onDefaultUploadStorageClassChange: (value: AwsUploadStorageClass) => void;
  t: (key: string) => string;
};

export function AwsConnectionFields({
  accessKeyFieldId,
  secretKeyFieldId,
  accessKeyId,
  secretAccessKey,
  locale,
  defaultUploadStorageClass,
  errors,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  onDefaultUploadStorageClassChange,
  t
}: AwsConnectionFieldsProps) {
  return (
    <>
      <label className="field-group" htmlFor={accessKeyFieldId}>
        <span>{t("navigation.modal.aws.access_key_label")}</span>
        <input
          id={accessKeyFieldId}
          type="text"
          value={accessKeyId}
          placeholder={t("navigation.modal.aws.access_key_placeholder")}
          onChange={(event) => onAccessKeyIdChange(event.target.value)}
        />
        {errors.accessKeyId ? <span className="field-error">{errors.accessKeyId}</span> : null}
      </label>

      <label className="field-group" htmlFor={secretKeyFieldId}>
        <span>{t("navigation.modal.aws.secret_key_label")}</span>
        <input
          id={secretKeyFieldId}
          type="password"
          value={secretAccessKey}
          placeholder={t("navigation.modal.aws.secret_key_placeholder")}
          onChange={(event) => onSecretAccessKeyChange(event.target.value)}
        />
        {errors.secretAccessKey ? (
          <span className="field-error">{errors.secretAccessKey}</span>
        ) : null}
      </label>

      <AwsUploadStorageClassField
        locale={locale}
        value={defaultUploadStorageClass}
        onChange={onDefaultUploadStorageClassChange}
      />
    </>
  );
}
