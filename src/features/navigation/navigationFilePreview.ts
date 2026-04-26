import type { NavigationContentExplorerItem } from "./navigationContent";

export const FILE_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;

export type NavigationFilePreviewKind = "text" | "image";

export type NavigationFilePreviewPayload =
  | {
      kind: "text";
      content: string;
      mimeType: string;
    }
  | {
      kind: "image";
      base64: string;
      mimeType: string;
    };

export type NavigationFilePreviewState = {
  isEnabled: boolean;
  selectedItemId: string | null;
  requestId: number;
  isLoading: boolean;
  payload: NavigationFilePreviewPayload | null;
  error: string | null;
};

export type NavigationFilePreviewSupport =
  | {
      status: "supported";
      kind: NavigationFilePreviewKind;
      mimeType: string;
    }
  | {
      status: "empty" | "directory" | "archived" | "too_large" | "unsupported";
    };

const TEXT_EXTENSION_MIME_TYPES = new Map<string, string>([
  ["txt", "text/plain"],
  ["md", "text/markdown"],
  ["json", "application/json"],
  ["csv", "text/csv"],
  ["log", "text/plain"],
  ["xml", "application/xml"],
  ["yaml", "application/yaml"],
  ["yml", "application/yaml"],
  ["ini", "text/plain"],
  ["toml", "application/toml"]
]);

const IMAGE_EXTENSION_MIME_TYPES = new Map<string, string>([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["bmp", "image/bmp"]
]);

export function buildInitialFilePreviewState(): NavigationFilePreviewState {
  return {
    isEnabled: false,
    selectedItemId: null,
    requestId: 0,
    isLoading: false,
    payload: null,
    error: null
  };
}

export function getFilePreviewExtension(fileName: string): string | null {
  const normalizedName = fileName.trim().toLocaleLowerCase();
  const extensionIndex = normalizedName.lastIndexOf(".");

  if (extensionIndex <= 0 || extensionIndex === normalizedName.length - 1) {
    return null;
  }

  return normalizedName.slice(extensionIndex + 1);
}

export function getFilePreviewSupport(
  item: NavigationContentExplorerItem | null | undefined,
  maxBytes = FILE_PREVIEW_MAX_BYTES
): NavigationFilePreviewSupport {
  if (!item) {
    return { status: "empty" };
  }

  if (item.kind !== "file") {
    return { status: "directory" };
  }

  if (item.availabilityStatus === "archived" || item.availabilityStatus === "restoring") {
    return { status: "archived" };
  }

  if (typeof item.size === "number" && item.size > maxBytes) {
    return { status: "too_large" };
  }

  const extension = getFilePreviewExtension(item.name);

  if (!extension) {
    return { status: "unsupported" };
  }

  const textMimeType = TEXT_EXTENSION_MIME_TYPES.get(extension);

  if (textMimeType) {
    return {
      status: "supported",
      kind: "text",
      mimeType: textMimeType
    };
  }

  const imageMimeType = IMAGE_EXTENSION_MIME_TYPES.get(extension);

  if (imageMimeType) {
    return {
      status: "supported",
      kind: "image",
      mimeType: imageMimeType
    };
  }

  return { status: "unsupported" };
}

export function buildFilePreviewDataUrl(payload: NavigationFilePreviewPayload): string | null {
  if (payload.kind !== "image") {
    return null;
  }

  return `data:${payload.mimeType};base64,${payload.base64}`;
}

export function isFormattableTextPreviewPayload(payload: NavigationFilePreviewPayload): boolean {
  return (
    payload.kind === "text" &&
    (payload.mimeType === "application/json" || payload.mimeType === "application/xml")
  );
}

export function formatTextPreviewContent(content: string, mimeType: string): string {
  if (mimeType === "application/json") {
    return JSON.stringify(JSON.parse(content), null, 2);
  }

  if (mimeType === "application/xml") {
    return formatXmlPreviewContent(content);
  }

  return content;
}

function formatXmlPreviewContent(content: string): string {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return content;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(trimmedContent, "application/xml");

  if (document.querySelector("parsererror")) {
    throw new Error("Invalid XML");
  }

  const serializedContent = new XMLSerializer()
    .serializeToString(document)
    .replace(/>\s*</g, "><")
    .replace(/(>)(<)(\/*)/g, "$1\n$2$3");
  let indentLevel = 0;

  return serializedContent
    .split("\n")
    .map((line) => {
      const normalizedLine = line.trim();

      if (!normalizedLine) {
        return "";
      }

      if (normalizedLine.match(/^<\//)) {
        indentLevel = Math.max(indentLevel - 1, 0);
      }

      const formattedLine = `${"  ".repeat(indentLevel)}${normalizedLine}`;

      if (
        normalizedLine.match(/^<[^!?/][^>]*[^/]>/) &&
        !normalizedLine.match(/^<[^>]+>.*<\/[^>]+>$/)
      ) {
        indentLevel += 1;
      }

      return formattedLine;
    })
    .join("\n");
}
