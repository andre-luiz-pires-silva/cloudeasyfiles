type AzureConnectionPlaceholderProps = {
  t: (key: string) => string;
};

export function AzureConnectionPlaceholder({ t }: AzureConnectionPlaceholderProps) {
  return (
    <div className="form-placeholder">
      <p className="form-placeholder-title">{t("navigation.modal.azure.placeholder_title")}</p>
      <p className="form-placeholder-copy">{t("navigation.modal.azure.placeholder_copy")}</p>
    </div>
  );
}
