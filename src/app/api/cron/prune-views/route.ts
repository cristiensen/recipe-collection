import { pruneRecipeViews } from "@/lib/views";

/**
 * Daily cleanup of view counts older than a week (scheduled in vercel.json).
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; nothing else may
 * call it, so it stays closed when the secret isn't set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deleted = await pruneRecipeViews();
  return Response.json({ deleted });
}
