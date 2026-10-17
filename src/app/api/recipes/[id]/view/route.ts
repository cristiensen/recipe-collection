import { type NextRequest, NextResponse, userAgent } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { recordRecipeView } from "@/lib/views";

const SEEN_COOKIE = "viewed";
/** A browser counts once per recipe in this many seconds. */
const SEEN_SECONDS = 60 * 60 * 24;

const ignored = () => new NextResponse(null, { status: 204 });

/**
 * Counts a view of a recipe. Called by `ViewBeacon` once the page is open in
 * a browser, so link prefetches and crawlers that don't run scripts never
 * count. Always answers 204: the caller has nothing to do with the outcome.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/recipes/[id]/view">,
) {
  const { id } = await ctx.params;
  if (userAgent(request).isBot) return ignored();
  // Reloads and return visits within a day are the same view
  if (request.cookies.has(SEEN_COOKIE)) return ignored();

  try {
    const viewer = await getCurrentUser();
    if (!(await recordRecipeView(id, viewer))) return ignored();
  } catch (e) {
    console.error("recordRecipeView failed", e);
    return ignored();
  }

  const response = ignored();
  // Scoped to this endpoint, so it is never sent with any other request
  response.cookies.set(SEEN_COOKIE, "1", {
    path: request.nextUrl.pathname,
    maxAge: SEEN_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
