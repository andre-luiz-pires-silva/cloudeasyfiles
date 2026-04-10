import type { AzureUploadTier } from "../connections/azureUploadTiers";

type Translate = (key: string) => string;

type AzureUploadTierDefinition = {
  storageClass: AzureUploadTier;
  key: string;
};

const AZURE_ACCESS_TIERS_DOCUMENTATION_URL =
  "https://learn.microsoft.com/azure/storage/blobs/access-tiers-overview";
const AZURE_PRICING_DOCUMENTATION_URL = "https://azure.microsoft.com/pricing/details/storage/blobs/";

const AZURE_UPLOAD_TIER_DEFINITIONS: AzureUploadTierDefinition[] = [
  { storageClass: "Hot", key: "hot" },
  { storageClass: "Cool", key: "cool" },
  { storageClass: "Cold", key: "cold" },
  { storageClass: "Archive", key: "archive" }
] as const;

export function getAzureUploadTierContent(t: Translate) {
  return {
    label: t("azure.upload_tier.label"),
    helper: t("azure.upload_tier.helper"),
    availabilityLabel: t("azure.upload_tier.availability_label"),
    costLabel: t("azure.upload_tier.cost_label"),
    providerCodeLabel: t("azure.upload_tier.provider_code_label"),
    noteTitle: t("azure.upload_tier.note_title"),
    noteBody: t("azure.upload_tier.note_body"),
    noteDocsBody: t("azure.upload_tier.note_docs_body"),
    pricingDocsLabel: t("azure.upload_tier.pricing_docs_label"),
    storageClassesDocsLabel: t("azure.upload_tier.storage_classes_docs_label"),
    pricingDocumentationUrl: AZURE_PRICING_DOCUMENTATION_URL,
    storageClassesDocumentationUrl: AZURE_ACCESS_TIERS_DOCUMENTATION_URL,
    options: AZURE_UPLOAD_TIER_DEFINITIONS.map((option) => ({
      storageClass: option.storageClass,
      title: t(`azure.storage_class.${option.key}.title`),
      useCase: t(`azure.storage_class.${option.key}.use_case`),
      availability: t(`azure.storage_class.${option.key}.availability`),
      cost: t(`azure.storage_class.${option.key}.cost`)
    }))
  };
}
