import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/privileges";
import { visibleRecipeSql } from "@/lib/visibility";

/** How far back "this week" rows look, and how long daily view counts are kept. */
export const TRENDING_DAYS = 7;

/** The first UTC day that is too old to count (days after it are "this week"). */
export const trendingCutoff = Prisma.sql`(now() AT TIME ZONE 'UTC')::date - ${TRENDING_DAYS}::int`;

/**
 * Counts one view: the all-time total and today's row, in one statement so
 * they can't drift apart. Returns whether it counted: authors don't add to
 * their own numbers, and deleted or hidden recipes can't be viewed.
 * Raw SQL because a Prisma update would also touch `updatedAt`.
 */
export async function recordRecipeView(recipeId: string, viewer: Actor | null) {
  const counted = await prisma.$executeRaw`
    WITH viewed AS (
      UPDATE "Recipe" r SET "viewCount" = r."viewCount" + 1
      FROM "User" a
      WHERE r.id = ${recipeId} AND a.id = r."authorId"
        AND a.id <> ${viewer?.id ?? ""}
        AND ${visibleRecipeSql(viewer, "r", "a")}
      RETURNING r.id
    )
    INSERT INTO "RecipeViewDay" ("recipeId", day, count)
    SELECT id, (now() AT TIME ZONE 'UTC')::date, 1 FROM viewed
    ON CONFLICT ("recipeId", day)
    DO UPDATE SET count = "RecipeViewDay".count + 1`;
  return counted > 0;
}

/** Deletes daily counts that no longer feed "this week"; returns how many. */
export function pruneRecipeViews() {
  return prisma.$executeRaw`
    DELETE FROM "RecipeViewDay" WHERE day <= ${trendingCutoff}`;
}
