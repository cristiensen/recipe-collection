import type { ThemePreference } from "@/generated/prisma/enums";

export type Theme = "dark" | "light";

export const THEME_COOKIE = "theme";
/** The dark blue theme is the app default; users can switch to light. */
export const DEFAULT_THEME: Theme = "dark";

function isTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function parseTheme(value: string | undefined): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

export const toPreference = (theme: Theme): ThemePreference =>
  theme === "light" ? "LIGHT" : "DARK";

export const fromPreference = (pref: ThemePreference): Theme =>
  pref === "LIGHT" ? "light" : "dark";

/**
 * Which theme to render. A logged-in user's saved account preference wins
 * (so it follows them across devices); otherwise the browser cookie; otherwise
 * the default.
 */
export function pickTheme(
  account: ThemePreference | null | undefined,
  cookie: string | undefined,
): Theme {
  return account ? fromPreference(account) : parseTheme(cookie);
}

/**
 * At login, reconcile the account and the browser:
 * - the account has a preference → it wins, and the cookie is updated to match
 *   (so the theme doesn't flip back after logging out);
 * - the account never chose one → adopt the theme picked as a guest, if any.
 */
export function reconcileAtLogin(
  account: ThemePreference | null | undefined,
  cookie: string | undefined,
): { saveToAccount: ThemePreference | null; setCookie: Theme | null } {
  if (account)
    return { saveToAccount: null, setCookie: fromPreference(account) };
  if (isTheme(cookie))
    return { saveToAccount: toPreference(cookie), setCookie: null };
  return { saveToAccount: null, setCookie: null };
}
