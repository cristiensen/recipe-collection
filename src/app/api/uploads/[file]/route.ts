import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_UPLOAD_DIR, localStorageAllowed } from "@/lib/storage";

const FILE = /^[A-Za-z0-9_-]+\.(jpg|png|webp|mp4|webm)$/;
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** Serves development uploads from `.uploads/`. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/uploads/[file]">,
) {
  const { file } = await ctx.params;
  const match = FILE.exec(file);
  if (!localStorageAllowed() || !match) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await readFile(
      path.join(/*turbopackIgnore: true*/ LOCAL_UPLOAD_DIR, file),
    );
    return new Response(data, {
      headers: {
        "content-type": TYPES[match[1]],
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
