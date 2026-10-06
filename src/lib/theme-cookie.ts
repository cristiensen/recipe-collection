import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { reconcileAtLogin, THEME_COOKIE, type Theme } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function readThemeCookie() {
  return (await cookies()).get(THEME_COOKIE)?.value;
}

export async function writeThemeCookie(theme: Theme) {
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}

/** Runs once after a successful sign-in (including right after sign-up). */
export async function reconcileThemeAtLogin(userId: string) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { theme: true },
  });
  const { saveToAccount, setCookie } = reconcileAtLogin(
    account?.theme,
    await readThemeCookie(),
  );
  if (saveToAccount) {
    await prisma.user.update({
      where: { id: userId },
      data: { theme: saveToAccount },
    });
  }
  if (setCookie) await writeThemeCookie(setCookie);
}
