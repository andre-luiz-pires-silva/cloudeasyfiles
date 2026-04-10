import { getAzureUploadTierContent } from "../../azure/azureProviderContent";
import { useI18n } from "../../../lib/i18n/useI18n";
import { type AzureUploadTier } from "../azureUploadTiers";
import { StorageTierSelector } from "./StorageTierSelector";

type AzureUploadTierFieldProps = {
  value: AzureUploadTier;
  onChange: (value: AzureUploadTier) => void;
};

export function AzureUploadTierField({ value, onChange }: AzureUploadTierFieldProps) {
  const { t } = useI18n();

  return (
    <StorageTierSelector
      value={value}
      onChange={onChange}
      content={getAzureUploadTierContent(t)}
      name="azure-upload-tier"
    />
  );
}
