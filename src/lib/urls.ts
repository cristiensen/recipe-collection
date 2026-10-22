/** The site's public origin, for absolute links (social previews, emails). */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export function loginHref(returnTo: string) {
  return `/login?callbackUrl=${encodeURIComponent(returnTo)}`;
}

/** Only allow same-site relative paths as post-login destinations (no open redirects). */
export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/";
  }
  return value;
}
