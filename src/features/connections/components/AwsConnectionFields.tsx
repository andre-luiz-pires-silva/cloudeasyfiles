import { AlertCircle, CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

const AWS_REGIONS = [
  { code: "us-east-1", label: "US East (N. Virginia)" },
  { code: "us-east-2", label: "US East (Ohio)" },
  { code: "us-west-1", label: "US West (N. California)" },
  { code: "us-west-2", label: "US West (Oregon)" },
  { code: "af-south-1", label: "Africa (Cape Town)" },
  { code: "ap-east-1", label: "Asia Pacific (Hong Kong)" },
  { code: "ap-south-2", label: "Asia Pacific (Hyderabad)" },
  { code: "ap-southeast-3", label: "Asia Pacific (Jakarta)" },
  { code: "ap-southeast-5", label: "Asia Pacific (Malaysia)" },
  { code: "ap-southeast-4", label: "Asia Pacific (Melbourne)" },
  { code: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { code: "ap-southeast-6", label: "Asia Pacific (New Zealand)" },
  { code: "ap-northeast-3", label: "Asia Pacific (Osaka)" },
  { code: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { code: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { code: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { code: "ap-east-2", label: "Asia Pacific (Taipei)" },
  { code: "ap-southeast-7", label: "Asia Pacific (Thailand)" },
  { code: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { code: "ca-central-1", label: "Canada (Central)" },
  { code: "ca-west-1", label: "Canada West (Calgary)" },
  { code: "eu-central-1", label: "Europe (Frankfurt)" },
  { code: "eu-west-1", label: "Europe (Ireland)" },
  { code: "eu-west-2", label: "Europe (London)" },
  { code: "eu-south-1", label: "Europe (Milan)" },
  { code: "eu-west-3", label: "Europe (Paris)" },
  { code: "eu-south-2", label: "Europe (Spain)" },
  { code: "eu-north-1", label: "Europe (Stockholm)" },
  { code: "eu-central-2", label: "Europe (Zurich)" },
  { code: "il-central-1", label: "Israel (Tel Aviv)" },
  { code: "mx-central-1", label: "Mexico (Central)" },
  { code: "me-south-1", label: "Middle East (Bahrain)" },
  { code: "me-central-1", label: "Middle East (UAE)" },
  { code: "sa-east-1", label: "South America (São Paulo)" }
] as const;

type ConnectionTestStatus = "idle" | "testing" | "success" | "error";

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
  connectionTestStatus: ConnectionTestStatus;
  connectionTestMessage: string | null;
  isTestButtonDisabled: boolean;
  onRegionChange: (value: string) => void;
  onAccessKeyIdChange: (value: string) => void;
  onSecretAccessKeyChange: (value: string) => void;
  onLocalCacheDirectoryChange: (value: string) => void;
  onTestConnection: () => void;
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
  connectionTestStatus,
  connectionTestMessage,
  isTestButtonDisabled,
  onRegionChange,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  onLocalCacheDirectoryChange,
  onTestConnection,
  t
}: AwsConnectionFieldsProps) {
  const regionExistsInOptions = AWS_REGIONS.some((option) => option.code === region);

  return (
    <>
      <label className="field-group" htmlFor={regionFieldId}>
        <span>{t("navigation.modal.aws.region_label")}</span>
        <select
          id={regionFieldId}
          value={region}
          onChange={(event) => onRegionChange(event.target.value)}
        >
          <option value="">{t("navigation.modal.aws.region_placeholder")}</option>
          {!regionExistsInOptions && region ? <option value={region}>{region}</option> : null}
          {AWS_REGIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label} ({option.code})
            </option>
          ))}
        </select>
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

      <div className="connection-test-panel">
        <div className="connection-test-header">
          <div>
            <span className="connection-test-label">
              {t("navigation.modal.aws.test_connection_label")}
            </span>
            <span className={`connection-test-status is-${connectionTestStatus}`}>
              {connectionTestStatus === "success" ? (
                <CheckCircle2 size={16} strokeWidth={2} />
              ) : connectionTestStatus === "error" ? (
                <XCircle size={16} strokeWidth={2} />
              ) : connectionTestStatus === "testing" ? (
                <LoaderCircle size={16} strokeWidth={2} className="connection-test-spinner" />
              ) : (
                <AlertCircle size={16} strokeWidth={2} />
              )}
              <span>{t(`navigation.modal.aws.test_connection_status.${connectionTestStatus}`)}</span>
            </span>
          </div>

          <button
            type="button"
            className="secondary-button"
            disabled={isTestButtonDisabled}
            onClick={onTestConnection}
          >
            {t("navigation.modal.aws.test_connection_button")}
          </button>
        </div>

        <p className="connection-test-message">
          {connectionTestMessage ?? t("navigation.modal.aws.test_connection_helper")}
        </p>
      </div>
    </>
  );
}
