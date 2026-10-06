import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_TYPES,
} from "@/lib/media";
import { getCurrentUser } from "@/lib/session";

const PATHNAME =
  /^recipes\/(images|videos)\/[A-Za-z0-9_-]+\.(jpg|png|webp|mp4|webm)$/;

/** Issues short-lived client-upload tokens for Vercel Blob (logged-in users only). */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user) throw new Error("You must be logged in to upload");
        const match = PATHNAME.exec(pathname);
        if (!match) throw new Error("Invalid upload path");
        const isVideo = match[1] === "videos";
        return {
          allowedContentTypes: isVideo ? [...VIDEO_TYPES] : [...IMAGE_TYPES],
          maximumSizeInBytes: isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
