import type { Locale } from "../../../lib/i18n/I18nProvider";
import { getAwsUploadTierContent } from "../../aws/awsProviderContent";
import { useI18n } from "../../../lib/i18n/useI18n";
import { AwsStorageClassSelector } from "./AwsStorageClassSelector";
import { type AwsUploadStorageClass } from "../awsUploadStorageClasses";

type AwsUploadStorageClassFieldProps = {
  locale: Locale;
  value: AwsUploadStorageClass;
  onChange: (value: AwsUploadStorageClass) => void;
};

export function AwsUploadStorageClassField({
  locale: _locale,
  value,
  onChange
}: AwsUploadStorageClassFieldProps) {
  const { t } = useI18n();

  return (
    <AwsStorageClassSelector
      value={value}
      onChange={onChange}
      content={getAwsUploadTierContent(t)}
      name="aws-upload-storage-class"
    />
  );
}
