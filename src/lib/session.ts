import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import type { ThemePreference } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/privileges";
import { loginHref } from "@/lib/urls";

export type CurrentUser = Actor & {
  name: string;
  theme: ThemePreference | null;
};

/**
 * The logged-in account, re-read from the database once per request so that
 * privilege changes, bans and deleted accounts take effect immediately rather
 * than when the session cookie expires.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      theme: true,
      privilegeLevel: true,
      bannedAt: true,
    },
  });
  if (!user) return null; // account was deleted: treat as logged out
  return {
    id: user.id,
    name: user.name,
    theme: user.theme,
    level: user.privilegeLevel,
    banned: user.bannedAt !== null,
  };
});

/** For protected pages: send guests to log in, then back to `returnTo` (US-1.3). */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginHref(returnTo));
  return user;
}
