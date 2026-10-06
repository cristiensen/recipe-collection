import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkMediaFile, extensionFor, type MediaKind } from "@/lib/media";
import { getCurrentUser } from "@/lib/session";
import {
  LOCAL_UPLOAD_DIR,
  LOCAL_URL_PREFIX,
  localStorageAllowed,
} from "@/lib/storage";

/** Development-only upload target used when Vercel Blob isn't configured. */
export async function POST(request: Request) {
  if (!localStorageAllowed()) {
    return Response.json(
      { error: "Media storage is not configured" },
      { status: 503 },
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "You must be logged in to upload" },
      { status: 401 },
    );
  }

  const kind: MediaKind =
    request.headers.get("x-media-kind") === "video" ? "video" : "image";
  const contentType = request.headers.get("content-type") ?? "";
  const data = Buffer.from(await request.arrayBuffer());
  const problem = checkMediaFile(
    { type: contentType, size: data.length },
    kind,
  );
  const ext = extensionFor(contentType);
  if (problem || !ext) {
    return Response.json(
      { error: problem ?? "Unsupported file" },
      { status: 400 },
    );
  }

  const name = `${randomUUID()}.${ext}`;
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(
    path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, name),
    data,
  );
  return Response.json({ url: `${LOCAL_URL_PREFIX}${name}` });
}
