import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import type { ThemePreference } from "@/generated/prisma/enums";
import { cached, userTag } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/privileges";
import { loginHref } from "@/lib/urls";

export type CurrentUser = Actor & {
  name: string;
  theme: ThemePreference | null;
};

/** An account as `getCurrentUser` returns it, plus when its password was
 * last reset (ms; the cache stores JSON, so no Date). */
async function loadUser(
  id: string,
): Promise<(CurrentUser & { passwordChangedAt: number | null }) | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      theme: true,
      privilegeLevel: true,
      bannedAt: true,
      passwordChangedAt: true,
    },
  });
  if (!user) return null; // account was deleted: treat as logged out
  return {
    id: user.id,
    name: user.name,
    theme: user.theme,
    level: user.privilegeLevel,
    banned: user.bannedAt !== null,
    passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
  };
}

/**
 * The logged-in account, read from the database rather than the session
 * cookie so that privilege changes, bans and deleted accounts take effect
 * immediately rather than when the cookie expires. It's on every page, so
 * it's cached across requests until something calls `userChanged`; changes
 * made outside the app (e.g. `npm run set-level`) show within 5 minutes.
 * Returns null for sessions that predate the account's last password reset.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await cached(() => loadUser(id), ["current-user", id], {
    tags: [userTag(id)],
    revalidate: 300,
  });
  // Sessions that logged in before a password reset are signed out
  if (!user || (user.passwordChangedAt ?? 0) > (session.loginAt ?? 0)) {
    return null;
  }
  return user;
});

/** For protected pages: send guests to log in, then back to `returnTo` (US-1.3). */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginHref(returnTo));
  return user;
}
