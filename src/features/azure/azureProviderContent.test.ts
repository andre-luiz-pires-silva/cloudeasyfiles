import { describe, expect, it } from "vitest";
import { getAzureUploadTierContent } from "./azureProviderContent";

const t = (key: string) => key;

describe("getAzureUploadTierContent", () => {
  it("returns translated label fields using the translator", () => {
    const content = getAzureUploadTierContent(t);
    expect(content.label).toBe("azure.upload_tier.label");
    expect(content.helper).toBe("azure.upload_tier.helper");
    expect(content.availabilityLabel).toBe("azure.upload_tier.availability_label");
    expect(content.costLabel).toBe("azure.upload_tier.cost_label");
    expect(content.providerCodeLabel).toBe("azure.upload_tier.provider_code_label");
    expect(content.noteTitle).toBe("azure.upload_tier.note_title");
    expect(content.noteBody).toBe("azure.upload_tier.note_body");
    expect(content.noteDocsBody).toBe("azure.upload_tier.note_docs_body");
    expect(content.pricingDocsLabel).toBe("azure.upload_tier.pricing_docs_label");
    expect(content.storageClassesDocsLabel).toBe("azure.upload_tier.storage_classes_docs_label");
  });

  it("returns the correct documentation URLs", () => {
    const content = getAzureUploadTierContent(t);
    expect(content.pricingDocumentationUrl).toBe(
      "https://azure.microsoft.com/pricing/details/storage/blobs/"
    );
    expect(content.storageClassesDocumentationUrl).toBe(
      "https://learn.microsoft.com/azure/storage/blobs/access-tiers-overview"
    );
  });

  it("returns all 4 storage tier options", () => {
    const content = getAzureUploadTierContent(t);
    expect(content.options).toHaveLength(4);
  });

  it("maps option fields through translator with correct keys", () => {
    const content = getAzureUploadTierContent(t);
    const hot = content.options[0];
    expect(hot.storageClass).toBe("Hot");
    expect(hot.title).toBe("azure.storage_class.hot.title");
    expect(hot.useCase).toBe("azure.storage_class.hot.use_case");
    expect(hot.availability).toBe("azure.storage_class.hot.availability");
    expect(hot.cost).toBe("azure.storage_class.hot.cost");
  });

  it("includes all expected tier codes in order", () => {
    const content = getAzureUploadTierContent(t);
    const classes = content.options.map((o) => o.storageClass);
    expect(classes).toEqual(["Hot", "Cool", "Cold", "Archive"]);
  });

  it("applies a custom translator to all fields", () => {
    const upper = (key: string) => key.toUpperCase();
    const content = getAzureUploadTierContent(upper);
    expect(content.label).toBe("AZURE.UPLOAD_TIER.LABEL");
    expect(content.options[0].title).toBe("AZURE.STORAGE_CLASS.HOT.TITLE");
  });
});
