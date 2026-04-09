import { openExternalUrl } from "../../../lib/tauri/awsConnections";
import { type AwsUploadStorageClass } from "../awsUploadStorageClasses";

type AwsStorageClassOption = {
  storageClass: AwsUploadStorageClass;
  title: string;
  useCase: string;
  availability: string;
  cost: string;
};

export type AwsStorageClassSelectorContent = {
  label: string;
  helper: string;
  availabilityLabel: string;
  costLabel: string;
  awsCodeLabel: string;
  noteTitle?: string;
  noteBody?: string;
  noteDocsBody?: string;
  pricingDocsLabel?: string;
  storageClassesDocsLabel?: string;
  pricingDocumentationUrl?: string;
  storageClassesDocumentationUrl?: string;
  options: AwsStorageClassOption[];
};

type AwsStorageClassSelectorProps = {
  value: AwsUploadStorageClass | null;
  onChange: (value: AwsUploadStorageClass) => void;
  content: AwsStorageClassSelectorContent;
  name?: string;
  allowedOptions?: AwsUploadStorageClass[];
};

export function AwsStorageClassSelector({
  value,
  onChange,
  content,
  name = "aws-storage-class",
  allowedOptions
}: AwsStorageClassSelectorProps) {
  const options = allowedOptions
    ? content.options.filter((option) => allowedOptions.includes(option.storageClass))
    : content.options;
  const pricingDocumentationUrl = content.pricingDocumentationUrl;
  const storageClassesDocumentationUrl = content.storageClassesDocumentationUrl;

  return (
    <div className="connection-form-section">
      <div className="connection-form-section-header">
        <strong>{content.label}</strong>
        <span>{content.helper}</span>
      </div>

      <div className="storage-class-card-list">
        {options.map((option) => {
          const checked = option.storageClass === value;

          return (
            <label
              key={option.storageClass}
              className={`storage-class-card${checked ? " is-selected" : ""}`}
            >
              <input
                type="radio"
                name={name}
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

      {content.noteTitle && content.noteBody ? (
        <div className="connection-form-note">
          <strong>{content.noteTitle}</strong>
          <p>
            {content.noteBody}{" "}
            {pricingDocumentationUrl && content.pricingDocsLabel ? (
              <>
                <button
                  type="button"
                  className="inline-link-button"
                  onClick={() => {
                    void openExternalUrl(pricingDocumentationUrl);
                  }}
                >
                  {content.pricingDocsLabel}
                </button>
                .
              </>
            ) : null}
          </p>
          {content.noteDocsBody && storageClassesDocumentationUrl && content.storageClassesDocsLabel ? (
            <p>
              {content.noteDocsBody}{" "}
              <button
                type="button"
                className="inline-link-button"
                onClick={() => {
                  void openExternalUrl(storageClassesDocumentationUrl);
                }}
              >
                {content.storageClassesDocsLabel}
              </button>
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
