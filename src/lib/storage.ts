import "server-only";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { del } from "@vercel/blob";

/**
 * Media lives in Vercel Blob (US-2.2: object storage, not the database),
 * authenticated with Vercel OIDC: BLOB_STORE_ID picks the store and the SDK
 * reads VERCEL_OIDC_TOKEN. Without BLOB_STORE_ID, development falls back to
 * files in `.uploads/` served by /api/uploads/[file]. Production refuses the
 * fallback.
 */
export type StorageMode = "blob" | "local";

export function storageMode(): StorageMode {
  return process.env.BLOB_STORE_ID ? "blob" : "local";
}

export function localStorageAllowed() {
  return storageMode() === "local" && process.env.NODE_ENV !== "production";
}

export const LOCAL_UPLOAD_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  ".uploads",
);
export const LOCAL_URL_PREFIX = "/api/uploads/";

/** Best-effort cleanup after a recipe is deleted or media is replaced. */
export async function deleteMedia(urls: string[]) {
  const blobUrls = urls.filter((u) => u.startsWith("https://"));
  const localFiles = urls
    .filter((u) => u.startsWith(LOCAL_URL_PREFIX))
    .map((u) => path.basename(u));

  const tasks: Promise<unknown>[] = [];
  if (blobUrls.length > 0 && storageMode() === "blob")
    tasks.push(del(blobUrls));
  for (const file of localFiles) {
    tasks.push(
      unlink(path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, file)),
    );
  }
  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected")
      console.error("Failed to delete media", r.reason);
  }
}
