import type { AwsRestoreTier } from "../../lib/tauri/awsConnections";
import type { AwsUploadStorageClass } from "../connections/awsUploadStorageClasses";

type Translate = (key: string) => string;

type AwsUploadTierDefinition = {
  storageClass: AwsUploadStorageClass;
  key: string;
};

type AwsRestoreTierDefinition = {
  tier: AwsRestoreTier;
  key: string;
};

const AWS_UPLOAD_STORAGE_CLASSES_DOCUMENTATION_URL =
  "https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html";
const AWS_PRICING_DOCUMENTATION_URL = "https://aws.amazon.com/s3/pricing/";
const AWS_RESTORE_DOCUMENTATION_URL =
  "https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html";

const AWS_UPLOAD_TIER_DEFINITIONS: AwsUploadTierDefinition[] = [
  { storageClass: "STANDARD", key: "standard" },
  { storageClass: "STANDARD_IA", key: "standard_ia" },
  { storageClass: "ONEZONE_IA", key: "onezone_ia" },
  { storageClass: "INTELLIGENT_TIERING", key: "intelligent_tiering" },
  { storageClass: "GLACIER_IR", key: "glacier_ir" },
  { storageClass: "GLACIER", key: "glacier" },
  { storageClass: "DEEP_ARCHIVE", key: "deep_archive" }
] as const;

const AWS_RESTORE_TIER_DEFINITIONS: AwsRestoreTierDefinition[] = [
  { tier: "expedited", key: "expedited" },
  { tier: "standard", key: "standard" },
  { tier: "bulk", key: "bulk" }
] as const;

export function getAwsUploadTierContent(t: Translate) {
  return {
    label: t("aws.upload_tier.label"),
    helper: t("aws.upload_tier.helper"),
    availabilityLabel: t("aws.upload_tier.availability_label"),
    costLabel: t("aws.upload_tier.cost_label"),
    providerCodeLabel: t("aws.upload_tier.aws_code_label"),
    noteTitle: t("aws.upload_tier.note_title"),
    noteBody: t("aws.upload_tier.note_body"),
    noteDocsBody: t("aws.upload_tier.note_docs_body"),
    pricingDocsLabel: t("aws.upload_tier.pricing_docs_label"),
    storageClassesDocsLabel: t("aws.upload_tier.storage_classes_docs_label"),
    pricingDocumentationUrl: AWS_PRICING_DOCUMENTATION_URL,
    storageClassesDocumentationUrl: AWS_UPLOAD_STORAGE_CLASSES_DOCUMENTATION_URL,
    options: AWS_UPLOAD_TIER_DEFINITIONS.map((option) => ({
      storageClass: option.storageClass,
      title: t(`aws.storage_class.${option.key}.title`),
      useCase: t(`aws.storage_class.${option.key}.use_case`),
      availability: t(`aws.storage_class.${option.key}.availability`),
      cost: t(`aws.storage_class.${option.key}.cost`)
    }))
  };
}

export function getAwsRestoreTierContent(t: Translate) {
  return {
    pricingDocumentationUrl: AWS_PRICING_DOCUMENTATION_URL,
    restoreDocumentationUrl: AWS_RESTORE_DOCUMENTATION_URL,
    options: AWS_RESTORE_TIER_DEFINITIONS.map((option) => ({
      tier: option.tier,
      title: t(`aws.restore_tier.${option.key}.title`),
      eta: t(`aws.restore_tier.${option.key}.eta`),
      cost: t(`aws.restore_tier.${option.key}.cost`),
      useCase: t(`aws.restore_tier.${option.key}.use_case`)
    }))
  };
}

export function getAwsChangeTierContent(t: Translate) {
  return {
    label: t("aws.change_tier.label"),
    helper: t("aws.change_tier.helper"),
    availabilityLabel: t("aws.change_tier.availability_label"),
    costLabel: t("aws.change_tier.cost_label"),
    providerCodeLabel: t("aws.change_tier.aws_code_label"),
    noteTitle: t("aws.change_tier.note_title"),
    noteBody: t("aws.change_tier.note_body"),
    noteDocsBody: t("aws.change_tier.note_docs_body"),
    pricingDocsLabel: t("aws.change_tier.pricing_docs_label"),
    storageClassesDocsLabel: t("aws.change_tier.storage_classes_docs_label"),
    pricingDocumentationUrl: AWS_PRICING_DOCUMENTATION_URL,
    storageClassesDocumentationUrl: AWS_UPLOAD_STORAGE_CLASSES_DOCUMENTATION_URL,
    options: AWS_UPLOAD_TIER_DEFINITIONS.map((option) => ({
      storageClass: option.storageClass,
      title: t(`aws.storage_class.${option.key}.title`),
      useCase: t(`aws.storage_class.${option.key}.use_case`),
      availability: t(`aws.storage_class.${option.key}.availability`),
      cost: t(`aws.storage_class.${option.key}.cost`)
    }))
  };
}
