/** Upload limits and URL checks shared by the browser and the server (US-2.2). */

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

export type MediaKind = "image" | "video";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function extensionFor(contentType: string): string | undefined {
  return EXTENSIONS[contentType];
}

/** Returns an error message, or null if the file may be uploaded as `kind`. */
export function checkMediaFile(
  file: { type: string; size: number },
  kind: MediaKind,
): string | null {
  const types: readonly string[] = kind === "image" ? IMAGE_TYPES : VIDEO_TYPES;
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (!types.includes(file.type)) {
    return kind === "image"
      ? "Images must be JPG, PNG or WebP"
      : "Video must be MP4 or WebM";
  }
  if (file.size > max) {
    return kind === "image"
      ? "Images must be 5 MB or smaller"
      : "Video must be 100 MB or smaller";
  }
  return null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|webm)$/i;
const LOCAL_PATH = /^\/api\/uploads\/[A-Za-z0-9_-]+\.[a-z0-9]+$/;
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Only URLs pointing at our own storage are accepted when saving a recipe, so a
 * crafted request can't make recipe pages load arbitrary third-party content.
 */
export function isAllowedMediaUrl(url: string, kind: MediaKind): boolean {
  const ext = kind === "image" ? IMAGE_EXT : VIDEO_EXT;
  if (url.startsWith("/")) return LOCAL_PATH.test(url) && ext.test(url);
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(BLOB_HOST_SUFFIX) &&
      ext.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}
