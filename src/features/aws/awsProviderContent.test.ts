import { describe, expect, it } from "vitest";
import {
  getAwsChangeTierContent,
  getAwsRestoreTierContent,
  getAwsUploadTierContent
} from "./awsProviderContent";

const t = (key: string) => key;

describe("getAwsUploadTierContent", () => {
  it("returns translated label fields using the translator", () => {
    const content = getAwsUploadTierContent(t);
    expect(content.label).toBe("aws.upload_tier.label");
    expect(content.helper).toBe("aws.upload_tier.helper");
    expect(content.availabilityLabel).toBe("aws.upload_tier.availability_label");
    expect(content.costLabel).toBe("aws.upload_tier.cost_label");
    expect(content.providerCodeLabel).toBe("aws.upload_tier.aws_code_label");
    expect(content.noteTitle).toBe("aws.upload_tier.note_title");
    expect(content.noteBody).toBe("aws.upload_tier.note_body");
    expect(content.noteDocsBody).toBe("aws.upload_tier.note_docs_body");
    expect(content.pricingDocsLabel).toBe("aws.upload_tier.pricing_docs_label");
    expect(content.storageClassesDocsLabel).toBe("aws.upload_tier.storage_classes_docs_label");
  });

  it("returns the correct documentation URLs", () => {
    const content = getAwsUploadTierContent(t);
    expect(content.pricingDocumentationUrl).toBe("https://aws.amazon.com/s3/pricing/");
    expect(content.storageClassesDocumentationUrl).toBe(
      "https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html"
    );
  });

  it("returns all 7 storage class options", () => {
    const content = getAwsUploadTierContent(t);
    expect(content.options).toHaveLength(7);
  });

  it("maps option fields through translator with correct keys", () => {
    const content = getAwsUploadTierContent(t);
    const standard = content.options[0];
    expect(standard.storageClass).toBe("STANDARD");
    expect(standard.title).toBe("aws.storage_class.standard.title");
    expect(standard.useCase).toBe("aws.storage_class.standard.use_case");
    expect(standard.availability).toBe("aws.storage_class.standard.availability");
    expect(standard.cost).toBe("aws.storage_class.standard.cost");
  });

  it("includes all expected storage class codes", () => {
    const content = getAwsUploadTierContent(t);
    const classes = content.options.map((o) => o.storageClass);
    expect(classes).toEqual([
      "STANDARD",
      "STANDARD_IA",
      "ONEZONE_IA",
      "INTELLIGENT_TIERING",
      "GLACIER_IR",
      "GLACIER",
      "DEEP_ARCHIVE"
    ]);
  });

  it("applies a custom translator to all fields", () => {
    const upper = (key: string) => key.toUpperCase();
    const content = getAwsUploadTierContent(upper);
    expect(content.label).toBe("AWS.UPLOAD_TIER.LABEL");
    expect(content.options[0].title).toBe("AWS.STORAGE_CLASS.STANDARD.TITLE");
  });
});

describe("getAwsRestoreTierContent", () => {
  it("returns the correct documentation URLs", () => {
    const content = getAwsRestoreTierContent(t);
    expect(content.pricingDocumentationUrl).toBe("https://aws.amazon.com/s3/pricing/");
    expect(content.restoreDocumentationUrl).toBe(
      "https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html"
    );
  });

  it("returns all 3 restore tier options", () => {
    const content = getAwsRestoreTierContent(t);
    expect(content.options).toHaveLength(3);
  });

  it("maps option fields through translator with correct keys", () => {
    const content = getAwsRestoreTierContent(t);
    const expedited = content.options[0];
    expect(expedited.tier).toBe("expedited");
    expect(expedited.title).toBe("aws.restore_tier.expedited.title");
    expect(expedited.eta).toBe("aws.restore_tier.expedited.eta");
    expect(expedited.cost).toBe("aws.restore_tier.expedited.cost");
    expect(expedited.useCase).toBe("aws.restore_tier.expedited.use_case");
  });

  it("includes all expected restore tier codes in order", () => {
    const content = getAwsRestoreTierContent(t);
    const tiers = content.options.map((o) => o.tier);
    expect(tiers).toEqual(["expedited", "standard", "bulk"]);
  });
});

describe("getAwsChangeTierContent", () => {
  it("returns translated label fields using the translator", () => {
    const content = getAwsChangeTierContent(t);
    expect(content.label).toBe("aws.change_tier.label");
    expect(content.helper).toBe("aws.change_tier.helper");
    expect(content.noteTitle).toBe("aws.change_tier.note_title");
    expect(content.noteBody).toBe("aws.change_tier.note_body");
  });

  it("returns the correct documentation URLs", () => {
    const content = getAwsChangeTierContent(t);
    expect(content.pricingDocumentationUrl).toBe("https://aws.amazon.com/s3/pricing/");
    expect(content.storageClassesDocumentationUrl).toBe(
      "https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html"
    );
  });

  it("returns all 7 storage class options", () => {
    const content = getAwsChangeTierContent(t);
    expect(content.options).toHaveLength(7);
  });

  it("maps option storage class and translated fields correctly", () => {
    const content = getAwsChangeTierContent(t);
    const deepArchive = content.options[6];
    expect(deepArchive.storageClass).toBe("DEEP_ARCHIVE");
    expect(deepArchive.title).toBe("aws.storage_class.deep_archive.title");
    expect(deepArchive.cost).toBe("aws.storage_class.deep_archive.cost");
  });
});
