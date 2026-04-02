import type { Locale } from "../../../lib/i18n/I18nProvider";
import { openExternalUrl } from "../../../lib/tauri/awsConnections";
import { getAwsUploadTierContent } from "../../aws/awsProviderContent";
import { type AwsUploadStorageClass } from "../awsUploadStorageClasses";

type AwsUploadStorageClassFieldProps = {
  locale: Locale;
  value: AwsUploadStorageClass;
  onChange: (value: AwsUploadStorageClass) => void;
};

export function AwsUploadStorageClassField({
  locale,
  value,
  onChange
}: AwsUploadStorageClassFieldProps) {
  const content = getAwsUploadTierContent(locale);

  return (
    <div className="connection-form-section">
      <div className="connection-form-section-header">
        <strong>{content.label}</strong>
        <span>{content.helper}</span>
      </div>

      <div className="storage-class-card-list">
        {content.options.map((option) => {
          const checked = option.storageClass === value;

          return (
            <label
              key={option.storageClass}
              className={`storage-class-card${checked ? " is-selected" : ""}`}
            >
              <input
                type="radio"
                name="aws-upload-storage-class"
                value={option.storageClass}
                checked={checked}
                onChange={() => onChange(option.storageClass)}
              />
              <span className={`storage-class-card-indicator${checked ? " is-selected" : ""}`}>
                <span className="storage-class-card-indicator-dot" />
              </span>
              <span className="storage-class-card-content">
                <span className="storage-class-card-copy">
                  <strong>{option.title}</strong>
                  <span>{option.useCase}</span>
                </span>
                <span className="storage-class-card-meta">
                  <span>
                    {content.availabilityLabel}: {option.availability}
                  </span>
                  <span>
                    {content.costLabel}: {option.cost}
                  </span>
                  <span>
                    {content.awsCodeLabel}: {option.storageClass}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="connection-form-note">
        <strong>{content.noteTitle}</strong>
        <p>
          {content.noteBody}{" "}
          <button
            type="button"
            className="inline-link-button"
            onClick={() => {
              void openExternalUrl(content.pricingDocumentationUrl);
            }}
          >
            {content.pricingDocsLabel}
          </button>
          .
        </p>
        <p>
          {content.noteDocsBody}{" "}
          <button
            type="button"
            className="inline-link-button"
            onClick={() => {
              void openExternalUrl(content.storageClassesDocumentationUrl);
            }}
          >
            {content.storageClassesDocsLabel}
          </button>
          .
        </p>
      </div>
    </div>
  );
}
