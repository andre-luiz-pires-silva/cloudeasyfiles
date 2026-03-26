type AwsConnectionFieldsProps = {
  regionFieldId: string;
  accessKeyFieldId: string;
  secretKeyFieldId: string;
  cacheDirectoryFieldId: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  localCacheDirectory: string;
  errors: Partial<Record<"region" | "accessKeyId" | "secretAccessKey", string>>;
  onRegionChange: (value: string) => void;
  onAccessKeyIdChange: (value: string) => void;
  onSecretAccessKeyChange: (value: string) => void;
  onLocalCacheDirectoryChange: (value: string) => void;
  t: (key: string) => string;
};

export function AwsConnectionFields({
  regionFieldId,
  accessKeyFieldId,
  secretKeyFieldId,
  cacheDirectoryFieldId,
  region,
  accessKeyId,
  secretAccessKey,
  localCacheDirectory,
  errors,
  onRegionChange,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  onLocalCacheDirectoryChange,
  t
}: AwsConnectionFieldsProps) {
  return (
    <>
      <label className="field-group" htmlFor={regionFieldId}>
        <span>{t("navigation.modal.aws.region_label")}</span>
        <input
          id={regionFieldId}
          type="text"
          value={region}
          placeholder={t("navigation.modal.aws.region_placeholder")}
          onChange={(event) => onRegionChange(event.target.value)}
        />
        {errors.region ? <span className="field-error">{errors.region}</span> : null}
      </label>

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

      <label className="field-group" htmlFor={cacheDirectoryFieldId}>
        <span>{t("navigation.modal.aws.cache_directory_label")}</span>
        <input
          id={cacheDirectoryFieldId}
          type="text"
          value={localCacheDirectory}
          placeholder={t("navigation.modal.aws.cache_directory_placeholder")}
          onChange={(event) => onLocalCacheDirectoryChange(event.target.value)}
        />
        <span className="field-helper">{t("navigation.modal.aws.cache_directory_helper")}</span>
      </label>
    </>
  );
}
