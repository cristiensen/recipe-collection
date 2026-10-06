import "server-only";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { pickTheme, type Theme, toPreference } from "@/lib/theme";
import { readThemeCookie, writeThemeCookie } from "@/lib/theme-cookie";

/** The theme for this request: the account's choice when logged in, else the cookie. */
export const getTheme = cache(async (): Promise<Theme> => {
  let account: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    account = await getCurrentUser();
  } catch (e) {
    unstable_rethrow(e); // let Next.js handle its own control-flow errors
    // The theme is cosmetic: never fail the whole page over it.
    console.error("Couldn't load the account theme; using the cookie", e);
  }
  return pickTheme(account?.theme, await readThemeCookie());
});

/** Saves a toggle: always to the cookie, and to the account when logged in. */
export async function saveTheme(theme: Theme) {
  await writeThemeCookie(theme);
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.updateMany({
      where: { id: user.id },
      data: { theme: toPreference(theme) },
    });
  }
}
