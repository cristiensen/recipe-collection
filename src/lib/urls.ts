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
