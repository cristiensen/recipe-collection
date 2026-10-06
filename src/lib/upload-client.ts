import { upload } from "@vercel/blob/client";
import { extensionFor, type MediaKind } from "@/lib/media";

export type StorageMode = "blob" | "local";

/** Uploads one file from the browser and resolves with its public URL. */
export async function uploadMedia(
  file: File,
  kind: MediaKind,
  mode: StorageMode,
  onProgress: (percent: number) => void,
): Promise<string> {
  const ext = extensionFor(file.type);
  if (!ext) throw new Error("Unsupported file type");

  if (mode === "blob") {
    const base = file.name
      .replace(/\.[^.]*$/, "")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .slice(0, 40);
    const blob = await upload(`recipes/${kind}s/${base || kind}.${ext}`, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      contentType: file.type,
      multipart: kind === "video",
      onUploadProgress: (e) => onProgress(e.percentage),
    });
    return blob.url;
  }

  // Development fallback: XMLHttpRequest because fetch has no upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-media-kind", kind);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body.url);
        else reject(new Error(body.error ?? "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
