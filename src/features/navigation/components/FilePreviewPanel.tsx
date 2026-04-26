import { Braces, CircleAlert, FileText, Image, LoaderCircle, ZoomIn, ZoomOut } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  buildFilePreviewDataUrl,
  FILE_PREVIEW_MAX_BYTES,
  formatTextPreviewContent,
  isFormattableTextPreviewPayload
} from "../navigationFilePreview";
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
  const [imageZoom, setImageZoom] = useState(1);
  const [formattedTextContent, setFormattedTextContent] = useState<string | null>(null);
  const canZoomImage = payload?.kind === "image";
  const canFormatText = payload ? isFormattableTextPreviewPayload(payload) : false;

  useEffect(() => {
    setImageZoom(1);
    setFormattedTextContent(null);
  }, [payload]);

  return (
    <aside className="file-preview-panel" aria-label={t("content.preview.panel_label")}>
      <div className="file-preview-header">
        <div className="file-preview-title-group">
          <p className="file-preview-eyebrow">{t("content.preview.eyebrow")}</p>
          <h2 className="file-preview-title" title={item?.name}>
            {item?.name ?? t("content.preview.empty_title")}
          </h2>
        </div>
        <div className="file-preview-header-side">
          {item?.kind === "file" ? (
            <span className="file-preview-size">{formatBytes(item.size, locale)}</span>
          ) : null}
          {canZoomImage ? (
            <div className="file-preview-tools" aria-label={t("content.preview.tools_label")}>
              <button
                type="button"
                className="file-preview-tool-button"
                aria-label={t("content.preview.zoom_out")}
                title={t("content.preview.zoom_out")}
                disabled={imageZoom <= 0.5}
                onClick={() => setImageZoom((currentZoom) => Math.max(currentZoom - 0.25, 0.5))}
              >
                <ZoomOut size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="file-preview-tool-button"
                aria-label={t("content.preview.zoom_in")}
                title={t("content.preview.zoom_in")}
                disabled={imageZoom >= 3}
                onClick={() => setImageZoom((currentZoom) => Math.min(currentZoom + 0.25, 3))}
              >
                <ZoomIn size={16} strokeWidth={2} />
              </button>
            </div>
          ) : null}
          {payload?.kind === "text" && canFormatText ? (
            <div className="file-preview-tools" aria-label={t("content.preview.tools_label")}>
              <button
                type="button"
                className="file-preview-tool-button"
                aria-label={t("content.preview.format")}
                title={t("content.preview.format")}
                onClick={() => {
                  try {
                    setFormattedTextContent(
                      formatTextPreviewContent(payload.content, payload.mimeType)
                    );
                  } catch {
                    setFormattedTextContent(payload.content);
                  }
                }}
              >
                <Braces size={16} strokeWidth={2} />
              </button>
            </div>
          ) : null}
        </div>
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
          <FilePreviewPayloadView
            payload={payload}
            t={t}
            imageZoom={imageZoom}
            formattedTextContent={formattedTextContent}
          />
        ) : (
          <FilePreviewSupportState support={support} t={t} locale={locale} />
        )}
      </div>
    </aside>
  );
}

function FilePreviewPayloadView({
  payload,
  t,
  imageZoom,
  formattedTextContent
}: {
  payload: NavigationFilePreviewPayload;
  t: (key: string) => string;
  imageZoom: number;
  formattedTextContent: string | null;
}) {
  const imageWrapRef = useRef<HTMLDivElement | null>(null);
  const imagePanStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  if (payload.kind === "text") {
    const displayedTextContent = formattedTextContent ?? payload.content;

    return (
      <div className="file-preview-text-wrap">
        <pre className="file-preview-text">
          {displayedTextContent || t("content.preview.empty_file")}
        </pre>
      </div>
    );
  }

  const imageUrl = buildFilePreviewDataUrl(payload);

  return imageUrl ? (
    <div
      ref={imageWrapRef}
      className={`file-preview-image-wrap${imageZoom > 1 ? " is-pannable" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        if (imageZoom <= 1 || event.button !== 0) {
          return;
        }

        const imageWrap = imageWrapRef.current;

        if (!imageWrap) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        imageWrap.setPointerCapture(event.pointerId);
        imagePanStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: imageWrap.scrollLeft,
          scrollTop: imageWrap.scrollTop
        };
      }}
      onPointerMove={(event) => {
        const panState = imagePanStateRef.current;
        const imageWrap = imageWrapRef.current;

        if (!panState || !imageWrap || panState.pointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        imageWrap.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
        imageWrap.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
      }}
      onPointerUp={(event) => {
        if (imagePanStateRef.current?.pointerId === event.pointerId) {
          imagePanStateRef.current = null;
          imageWrapRef.current?.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={(event) => {
        if (imagePanStateRef.current?.pointerId === event.pointerId) {
          imagePanStateRef.current = null;
        }
      }}
    >
      <img
        className="file-preview-image"
        src={imageUrl}
        alt={t("content.preview.image_alt")}
        draggable={false}
        onDragStart={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        style={{ width: `${imageZoom * 100}%` }}
      />
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
