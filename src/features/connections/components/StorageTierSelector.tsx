import { openExternalUrl } from "../../../lib/tauri/awsConnections";

export type StorageTierOption<TValue extends string> = {
  storageClass: TValue;
  title: string;
  useCase: string;
  availability: string;
  cost: string;
};

export type StorageTierSelectorContent<TValue extends string> = {
  label: string;
  helper: string;
  availabilityLabel: string;
  costLabel: string;
  providerCodeLabel: string;
  noteTitle?: string;
  noteBody?: string;
  noteDocsBody?: string;
  pricingDocsLabel?: string;
  storageClassesDocsLabel?: string;
  pricingDocumentationUrl?: string;
  storageClassesDocumentationUrl?: string;
  options: StorageTierOption<TValue>[];
};

type StorageTierSelectorProps<TValue extends string> = {
  value: TValue | null;
  onChange: (value: TValue) => void;
  content: StorageTierSelectorContent<TValue>;
  name: string;
  allowedOptions?: TValue[];
};

export function StorageTierSelector<TValue extends string>({
  value,
  onChange,
  content,
  name,
  allowedOptions
}: StorageTierSelectorProps<TValue>) {
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
                    {content.providerCodeLabel}: {option.storageClass}
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
