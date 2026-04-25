import { CircleAlert, FileText, Image, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { buildFilePreviewDataUrl, FILE_PREVIEW_MAX_BYTES } from "../navigationFilePreview";
import type {
  NavigationFilePreviewPayload,
  NavigationFilePreviewSupport
} from "../navigationFilePreview";
import type { NavigationContentExplorerItem } from "../navigationContent";
import { formatBytes } from "../navigationPresentation";
import type { Locale } from "../../../lib/i18n/I18nProvider";

export type FilePreviewPanelProps = {
  item: NavigationContentExplorerItem | null;
  support: NavigationFilePreviewSupport;
  payload: NavigationFilePreviewPayload | null;
  isLoading: boolean;
  error: string | null;
  locale: Locale;
  t: (key: string) => string;
  onRetry: () => void;
};

export function FilePreviewPanel({
  item,
  support,
  payload,
  isLoading,
  error,
  locale,
  t,
  onRetry
}: FilePreviewPanelProps) {
  return (
    <aside className="file-preview-panel" aria-label={t("content.preview.panel_label")}>
      <div className="file-preview-header">
        <div className="file-preview-title-group">
          <p className="file-preview-eyebrow">{t("content.preview.eyebrow")}</p>
          <h2 className="file-preview-title" title={item?.name}>
            {item?.name ?? t("content.preview.empty_title")}
          </h2>
        </div>
        {item?.kind === "file" ? (
          <span className="file-preview-size">{formatBytes(item.size, locale)}</span>
        ) : null}
      </div>

      <div className="file-preview-body">
        {isLoading ? (
          <FilePreviewState
            icon={<LoaderCircle size={20} strokeWidth={2} />}
            title={t("content.preview.loading")}
          />
        ) : error ? (
          <FilePreviewState
            icon={<CircleAlert size={20} strokeWidth={2} />}
            title={t("content.preview.error_title")}
            body={error}
            actionLabel={t("content.preview.retry")}
            onAction={onRetry}
          />
        ) : payload ? (
          <FilePreviewPayloadView payload={payload} t={t} />
        ) : (
          <FilePreviewSupportState support={support} t={t} locale={locale} />
        )}
      </div>
    </aside>
  );
}

function FilePreviewPayloadView({
  payload,
  t
}: {
  payload: NavigationFilePreviewPayload;
  t: (key: string) => string;
}) {
  if (payload.kind === "text") {
    return <pre className="file-preview-text">{payload.content || t("content.preview.empty_file")}</pre>;
  }

  const imageUrl = buildFilePreviewDataUrl(payload);

  return imageUrl ? (
    <div className="file-preview-image-wrap">
      <img className="file-preview-image" src={imageUrl} alt={t("content.preview.image_alt")} />
    </div>
  ) : (
    <FilePreviewState
      icon={<CircleAlert size={20} strokeWidth={2} />}
      title={t("content.preview.error_title")}
    />
  );
}

function FilePreviewSupportState({
  support,
  t,
  locale
}: {
  support: NavigationFilePreviewSupport;
  t: (key: string) => string;
  locale: Locale;
}) {
  if (support.status === "supported") {
    return (
      <FilePreviewState
        icon={
          support.kind === "image" ? (
            <Image size={20} strokeWidth={2} />
          ) : (
            <FileText size={20} strokeWidth={2} />
          )
        }
        title={t("content.preview.ready")}
      />
    );
  }

  const messageKey =
    support.status === "empty"
      ? "content.preview.empty_description"
      : support.status === "directory"
        ? "content.preview.directory"
        : support.status === "archived"
          ? "content.preview.archived"
          : support.status === "too_large"
            ? "content.preview.too_large"
            : "content.preview.unsupported";

  return (
    <FilePreviewState
      icon={<FileText size={20} strokeWidth={2} />}
      title={t(messageKey).replace("{limit}", formatBytes(FILE_PREVIEW_MAX_BYTES, locale))}
    />
  );
}

function FilePreviewState({
  icon,
  title,
  body,
  actionLabel,
  onAction
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="file-preview-state">
      <span className="file-preview-state-icon">{icon}</span>
      <p>{title}</p>
      {body ? <span>{body}</span> : null}
      {actionLabel && onAction ? (
        <button type="button" className="secondary-button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
