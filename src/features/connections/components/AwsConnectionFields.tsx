import { AlertCircle, CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

type ConnectionTestStatus = "idle" | "testing" | "success" | "error";

type AwsConnectionFieldsProps = {
  accessKeyFieldId: string;
  secretKeyFieldId: string;
  accessKeyId: string;
  secretAccessKey: string;
  errors: Partial<Record<"accessKeyId" | "secretAccessKey", string>>;
  connectionTestStatus: ConnectionTestStatus;
  connectionTestMessage: string | null;
  isTestButtonDisabled: boolean;
  onAccessKeyIdChange: (value: string) => void;
  onSecretAccessKeyChange: (value: string) => void;
  onTestConnection: () => void;
  t: (key: string) => string;
};

export function AwsConnectionFields({
  accessKeyFieldId,
  secretKeyFieldId,
  accessKeyId,
  secretAccessKey,
  errors,
  connectionTestStatus,
  connectionTestMessage,
  isTestButtonDisabled,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  onTestConnection,
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
