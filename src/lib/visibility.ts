import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { type Actor, isStaff, LEVEL } from "@/lib/privileges";

/**
 * SQL condition on the user row `alias`: whether `viewer` may see their
 * content. Public profiles, the viewer's own, or everything for staff (the
 * same rule as `canSeeContentOf`).
 */
export function visibleUserSql(viewer: Actor | null, alias: string) {
  if (isStaff(viewer)) return Prisma.sql`TRUE`;
  const u = Prisma.raw(`"${alias}"`);
  return Prisma.sql`NOT (${u}."isPrivate"
    AND ${u}."privilegeLevel" >= ${LEVEL.CHEF}
    AND ${u}.id <> ${viewer?.id ?? ""})`;
}
