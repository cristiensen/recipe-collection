import { issueSignedToken } from "@vercel/blob";
import {
  type HandleUploadPresignedBody,
  handleUploadPresigned,
} from "@vercel/blob/client";
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_TYPES,
} from "@/lib/media";
import { getCurrentUser } from "@/lib/session";

const PATHNAME =
  /^recipes\/(images|videos)\/[A-Za-z0-9_-]+\.(jpg|png|webp|mp4|webm)$/;

/**
 * Issues short-lived presigned upload URLs for Vercel Blob (logged-in users only).
 * Authenticates to Blob with Vercel OIDC (VERCEL_OIDC_TOKEN + BLOB_STORE_ID);
 * the SDK also requires BLOB_WEBHOOK_PUBLIC_KEY.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user) throw new Error("You must be logged in to upload");
        const match = PATHNAME.exec(pathname);
        if (!match) throw new Error("Invalid upload path");
        const isVideo = match[1] === "videos";
        const constraints = {
          allowedContentTypes: isVideo ? [...VIDEO_TYPES] : [...IMAGE_TYPES],
          maximumSizeInBytes: isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
        };
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          ...constraints,
        });
        return { token, urlOptions: { ...constraints, addRandomSuffix: true } };
      },
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
