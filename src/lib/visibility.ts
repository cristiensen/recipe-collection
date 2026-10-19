import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  type Actor,
  canSeeHiddenRecipes,
  isStaff,
  LEVEL,
} from "@/lib/privileges";

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

/**
 * SQL condition on the recipe row `recipe` and its author row `author`:
 * whether `viewer` may see it (the same rule as `canSeeRecipe`).
 */
export function visibleRecipeSql(
  viewer: Actor | null,
  recipe: string,
  author: string,
) {
  const authorVisible = visibleUserSql(viewer, author);
  if (canSeeHiddenRecipes(viewer)) return authorVisible;
  const r = Prisma.raw(`"${recipe}"`);
  return Prisma.sql`(${r}."isPublic" OR ${r}."authorId" = ${viewer?.id ?? ""})
    AND ${authorVisible}`;
}
