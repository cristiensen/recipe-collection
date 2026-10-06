"use server";

import { parseTheme } from "@/lib/theme";
import { saveTheme } from "@/lib/theme-server";

/** Persists the header toggle (cookie, plus the account when logged in). */
export async function setThemeAction(theme: string) {
  await saveTheme(parseTheme(theme));
}
