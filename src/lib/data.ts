import "server-only";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import type { VoteType } from "@/generated/prisma/enums";
import { cachedLabels, cachedRecipeData } from "@/lib/cache";
import type { LabelOption } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import {
  type Actor,
  canDeleteAnyLabel,
  canDeleteLabel,
  hasPrivateProfile,
  LABEL_DELETE_WINDOW_MS,
} from "@/lib/privileges";
import {
  type BrowseFilters,
  compareReviews,
  type FeedFilters,
  type SortKey,
} from "@/lib/rules";
import { TRENDING_DAYS, trendingCutoff } from "@/lib/views";
import { visibleRecipeSql, visibleUserSql } from "@/lib/visibility";

// Hosted Postgres bills every query, so each list of cards below is one SQL
// statement (cards, their numbers and the list's total together), and pages
// load their lists together where they can.

export type RecipeCardData = {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  coverUrl: string | null;
  cookingMinutes: number;
  /** Label names. */
  labels: string[];
  averageRating: number | null;
  ratingCount: number;
  likeCount: number;
  /** Whether the current viewer has liked it (false for guests). */
  liked: boolean;
  /** Its author's profile is private (only they and staff can see it). */
  authorPrivate: boolean;
  /** Off when hidden from the public (only its author and chefs and up see it). */
  isPublic: boolean;
};

/** The person looking at the page (null for guests). */
type Viewer = Actor | null;

/** ORDER BY for each sort option. Ties fall back to newest first, so the
 * order is always stable (which "Load more" relies on). */
const ORDER_BY: Record<SortKey, Prisma.Sql> = {
  newest: Prisma.sql`r."createdAt" DESC, r.id DESC`,
  oldest: Prisma.sql`r."createdAt" ASC, r.id ASC`,
  // Unrated recipes go last in both directions
  "rating-desc": Prisma.sql`s.avg DESC NULLS LAST, r."createdAt" DESC, r.id DESC`,
  "rating-asc": Prisma.sql`s.avg ASC NULLS LAST, r."createdAt" DESC, r.id DESC`,
  "time-asc": Prisma.sql`r."cookingMinutes" ASC, r."createdAt" DESC, r.id DESC`,
  "time-desc": Prisma.sql`r."cookingMinutes" DESC, r."createdAt" DESC, r.id DESC`,
};

/** Most words of a search that are matched (the rest are ignored). */
const MAX_SEARCH_WORDS = 8;

function searchWords(query: string | undefined) {
  return [...new Set((query ?? "").split(" ").filter(Boolean))].slice(
    0,
    MAX_SEARCH_WORDS,
  );
}

/**
 * FROM + WHERE for the browse feed and the rows above it. It's SQL rather
 * than a Prisma query because sorting and filtering by average rating need
 * the aggregate; every value is passed as a query parameter. `join` narrows
 * or extends the recipes `r` (e.g. to the viewer's likes) for a row.
 */
function feedQuery(
  filters: FeedFilters,
  viewer: Viewer,
  join: Prisma.Sql = Prisma.empty,
) {
  // Recipes by private authors, and hidden recipes, are left out
  const conditions: Prisma.Sql[] = [visibleRecipeSql(viewer, "r", "a")];
  // Search: every word must appear in the title, description, an ingredient
  // or the name of one of the recipe's labels
  for (const word of searchWords(filters.query)) {
    const pattern = `%${word.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(Prisma.sql`(r.title ILIKE ${pattern}
      OR r.description ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM "Ingredient" g
        WHERE g."recipeId" = r.id AND g.name ILIKE ${pattern})
      OR EXISTS (SELECT 1 FROM "Label" lb
        WHERE lb.slug = ANY(r.labels) AND lb.name ILIKE ${pattern}))`);
  }
  // US-3.2: a recipe must have *all* selected labels
  if (filters.labels.length > 0) {
    conditions.push(Prisma.sql`r.labels @> ${filters.labels}::text[]`);
  }
  if (filters.maxTime) {
    conditions.push(Prisma.sql`r."cookingMinutes" <= ${filters.maxTime}`);
  }
  if (filters.minRating) {
    // Averages are shown rounded to 1 decimal ("4.0" for 3.96), so compare
    // against the same rounding: a recipe that *shows* 4.0 passes "4 and up".
    conditions.push(Prisma.sql`s.avg >= ${filters.minRating - 0.05}`);
  }
  return Prisma.sql`
    FROM "Recipe" r
    JOIN "User" a ON a.id = r."authorId"
    ${join}
    LEFT JOIN (
      SELECT "recipeId", AVG(rating) AS avg FROM "Review" GROUP BY "recipeId"
    ) s ON s."recipeId" = r.id
    WHERE ${Prisma.join(conditions, " AND ")}`;
}

/**
 * A list for `cardLists`: the first `take` recipes `r` of `from` (FROM, WHERE
 * and optionally GROUP BY r.id) in `orderBy` order, with each one's position
 * `ord` and the `total` number of matches before the limit.
 */
function listQuery(from: Prisma.Sql, orderBy: Prisma.Sql, take: number) {
  return Prisma.sql`
    SELECT r.id,
      ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS ord,
      COUNT(*) OVER () AS total
    ${from}
    ORDER BY ord
    LIMIT ${take}`;
}

type CardList = { recipes: RecipeCardData[]; total: number };

type CardRow = Omit<RecipeCardData, "authorPrivate"> & {
  list: number;
  total: number;
  authorIsPrivate: boolean;
  authorLevel: number;
};

/** Card data for several `listQuery` lists, in one query, in their order. */
async function cardLists(
  lists: Prisma.Sql[],
  viewerId: string | null,
): Promise<CardList[]> {
  const result = lists.map((): CardList => ({ recipes: [], total: 0 }));
  if (lists.length === 0) return result;
  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT o.list, o.total::int AS total,
      r.id, r.title, r."cookingMinutes", r."isPublic",
      ARRAY(SELECT lb.name FROM unnest(r.labels) WITH ORDINALITY u(slug, n)
        JOIN "Label" lb ON lb.slug = u.slug ORDER BY u.n) AS labels,
      r."authorId", a.name AS "authorName",
      a."isPrivate" AS "authorIsPrivate", a."privilegeLevel" AS "authorLevel",
      (SELECT i.url FROM "RecipeImage" i WHERE i."recipeId" = r.id
        ORDER BY i.position LIMIT 1) AS "coverUrl",
      rs.avg AS "averageRating", rs.count AS "ratingCount",
      (SELECT COUNT(*)::int FROM "RecipeLike" k
        WHERE k."recipeId" = r.id) AS "likeCount",
      EXISTS (SELECT 1 FROM "RecipeLike" k
        WHERE k."recipeId" = r.id AND k."userId" = ${viewerId ?? ""}) AS liked
    FROM (${Prisma.join(
      lists.map(
        (list, i) =>
          Prisma.sql`SELECT ${i}::int AS list, x.id, x.ord, x.total FROM (${list}) x`,
      ),
      " UNION ALL ",
    )}) o
    JOIN "Recipe" r ON r.id = o.id
    JOIN "User" a ON a.id = r."authorId"
    CROSS JOIN LATERAL (
      SELECT AVG(rating)::float8 AS avg, COUNT(*)::int AS count
      FROM "Review" WHERE "recipeId" = r.id
    ) rs
    ORDER BY o.list, o.ord`;
  for (const { list, total, authorIsPrivate, authorLevel, ...card } of rows) {
    result[list].total = total;
    result[list].recipes.push({
      ...card,
      authorPrivate: hasPrivateProfile({
        isPrivate: authorIsPrivate,
        level: authorLevel,
      }),
    });
  }
  return result;
}

// ──────────────────────────────── Labels ────────────────────────────────

/** Every label, oldest first (so the built-in ones come first). */
export const getLabels = cache(
  (): Promise<LabelOption[]> =>
    cachedLabels(() =>
      prisma.label.findMany({
        orderBy: [{ createdAt: "asc" }, { slug: "asc" }],
        select: { slug: true, name: true },
      }),
    ),
);

export type ManagedLabel = LabelOption & {
  /** null for built-in labels (or a deleted creator). */
  creatorName: string | null;
  recipeCount: number;
  canDelete: boolean;
  /** Whole minutes left to delete it, while only the creator's window allows it. */
  minutesLeft: number | null;
};

/**
 * The labels shown in Settings: all of them for admins (who can delete any),
 * otherwise the ones the viewer created, newest first.
 */
export async function getManagedLabels(viewer: Actor): Promise<ManagedLabel[]> {
  const all = canDeleteAnyLabel(viewer);
  const rows = await prisma.$queryRaw<
    (LabelOption & {
      createdById: string | null;
      createdAt: Date;
      creatorName: string | null;
      recipeCount: number;
    })[]
  >`
    SELECT l.slug, l.name, l."createdById", l."createdAt",
      u.name AS "creatorName",
      (SELECT COUNT(*)::int FROM "Recipe" r
        WHERE r.labels @> ARRAY[l.slug]) AS "recipeCount"
    FROM "Label" l
    LEFT JOIN "User" u ON u.id = l."createdById"
    ${all ? Prisma.empty : Prisma.sql`WHERE l."createdById" = ${viewer.id}`}
    ORDER BY l."createdAt" DESC, l.slug`;
  const now = new Date();
  return rows.map(({ createdById, createdAt, ...label }) => {
    const canDelete = canDeleteLabel(viewer, { createdById, createdAt }, now);
    const msLeft = createdAt.getTime() + LABEL_DELETE_WINDOW_MS - now.getTime();
    return {
      ...label,
      canDelete,
      minutesLeft: canDelete && !all ? Math.ceil(msLeft / 60_000) : null,
    };
  });
}

// ────────────────────────────── Browse page ──────────────────────────────

/** Most recipes a row above the browse feed shows. */
export const ROW_SIZE = 15;

/** The first `shown` recipes matching the filters, in the chosen order. */
function feedList(filters: BrowseFilters, viewer: Viewer) {
  return listQuery(
    feedQuery(filters, viewer),
    ORDER_BY[filters.sort],
    filters.shown,
  );
}

/** "What you love": the viewer's likes matching the filters, latest first. */
function lovedList(filters: FeedFilters, viewer: Actor) {
  return listQuery(
    feedQuery(
      filters,
      viewer,
      Prisma.sql`JOIN "RecipeLike" l
        ON l."recipeId" = r.id AND l."userId" = ${viewer.id}`,
    ),
    Prisma.sql`l."createdAt" DESC, r.id DESC`,
    ROW_SIZE,
  );
}

/** The recipes opened most in the last week (UTC days), most viewed first. */
function mostViewedList(filters: FeedFilters, viewer: Viewer) {
  return listQuery(
    Prisma.sql`${feedQuery(
      filters,
      viewer,
      Prisma.sql`JOIN "RecipeViewDay" v
        ON v."recipeId" = r.id AND v.day > ${trendingCutoff}`,
    )} GROUP BY r.id`,
    Prisma.sql`SUM(v.count) DESC, r."createdAt" DESC, r.id DESC`,
    ROW_SIZE,
  );
}

/** The recipes that got the most likes in the last week, most liked first. */
export async function getMostLikedThisWeek(
  filters: FeedFilters,
  viewer: Viewer,
) {
  // "createdAt" is stored in UTC without a time zone, so compare in UTC
  const [list] = await cardLists(
    [
      listQuery(
        Prisma.sql`${feedQuery(
          filters,
          viewer,
          Prisma.sql`JOIN "RecipeLike" l ON l."recipeId" = r.id
            AND l."createdAt" > (now() AT TIME ZONE 'UTC') - make_interval(days => ${TRENDING_DAYS}::int)`,
        )} GROUP BY r.id`,
        Prisma.sql`COUNT(*) DESC, r."createdAt" DESC, r.id DESC`,
        ROW_SIZE,
      ),
    ],
    viewer?.id ?? null,
  );
  return list.recipes;
}

async function loadBrowseLists(filters: BrowseFilters, viewer: Viewer) {
  // Search results are shown without the rows
  const rows = !filters.query;
  const [feed, hottest, loved] = await cardLists(
    [
      feedList(filters, viewer),
      ...(rows ? [mostViewedList(filters, viewer)] : []),
      ...(rows && viewer ? [lovedList(filters, viewer)] : []),
    ],
    viewer?.id ?? null,
  );
  return {
    /** The feed: the first `filters.shown` matches, in the chosen order. */
    recipes: feed.recipes,
    /** Every recipe matching the filters. */
    total: feed.total,
    /** Empty while searching. */
    hottest: hottest?.recipes ?? [],
    /** Empty for guests and while searching. */
    loved: loved?.recipes ?? [],
  };
}

/**
 * Everything the browse page lists, in one query. Guests all see the same
 * thing, so theirs is cached (see `cachedRecipeData`).
 */
export function getBrowseLists(filters: BrowseFilters, viewer: Viewer) {
  if (viewer) return loadBrowseLists(filters, viewer);
  return cachedRecipeData(
    () => loadBrowseLists(filters, null),
    ["browse-guest", JSON.stringify(filters)],
  );
}

// ──────────────────────────────── Profiles ────────────────────────────────

/** Public profile header: who they are and a few numbers. */
export const getUserProfile = cache(async (userId: string) => {
  const [user] = await prisma.$queryRaw<
    {
      id: string;
      name: string;
      privilegeLevel: number;
      isPrivate: boolean;
      createdAt: Date;
      recipeCount: number;
      reviewCount: number;
      likesReceived: number;
    }[]
  >`
    SELECT u.id, u.name, u."privilegeLevel", u."isPrivate", u."createdAt",
      (SELECT COUNT(*)::int FROM "Recipe" WHERE "authorId" = u.id) AS "recipeCount",
      (SELECT COUNT(*)::int FROM "Review" WHERE "userId" = u.id) AS "reviewCount",
      (SELECT COUNT(*)::int FROM "RecipeLike" l
        JOIN "Recipe" r ON r.id = l."recipeId"
        WHERE r."authorId" = u.id) AS "likesReceived"
    FROM "User" u
    WHERE u.id = ${userId}`;
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    level: user.privilegeLevel,
    /** The saved setting (shown in Settings). */
    isPrivate: user.isPrivate,
    memberSince: user.createdAt,
    recipeCount: user.recipeCount,
    reviewCount: user.reviewCount,
    likesReceived: user.likesReceived,
  };
});

/** Recipes a user published, newest first. */
/** (Callers check the profile is visible first.) */
export async function getUserRecipes(
  userId: string,
  take: number,
  viewer: Viewer,
) {
  const [list] = await cardLists(
    [
      listQuery(
        Prisma.sql`FROM "Recipe" r
          JOIN "User" a ON a.id = r."authorId"
          WHERE r."authorId" = ${userId} AND ${visibleRecipeSql(viewer, "r", "a")}`,
        Prisma.sql`r."createdAt" DESC, r.id DESC`,
        take,
      ),
    ],
    viewer?.id ?? null,
  );
  return list;
}

/** Recipes a user liked, most recently liked first. */
export async function getLikedRecipes(
  userId: string,
  take: number,
  viewer: Viewer,
) {
  const [list] = await cardLists(
    [
      listQuery(
        Prisma.sql`FROM "RecipeLike" l
          JOIN "Recipe" r ON r.id = l."recipeId"
          JOIN "User" a ON a.id = r."authorId"
          WHERE l."userId" = ${userId} AND ${visibleRecipeSql(viewer, "r", "a")}`,
        Prisma.sql`l."createdAt" DESC, l."recipeId" DESC`,
        take,
      ),
    ],
    viewer?.id ?? null,
  );
  return list;
}

/** Settings → Recipe visibility: every recipe a user wrote, newest first. */
export function getOwnRecipeVisibility(userId: string) {
  return prisma.recipe.findMany({
    where: { authorId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, title: true, isPublic: true },
  });
}

// ─────────────────────────────── Recipe page ───────────────────────────────

/**
 * A recipe's numbers (BR-9: every rating counts, whether or not it has a
 * comment), plus whether the viewer liked it and their own review.
 */
export async function getRecipeStats(
  recipeId: string,
  viewerId: string | null,
) {
  const [row] = await prisma.$queryRaw<
    {
      average: number | null;
      ratingCount: number;
      likeCount: number;
      liked: boolean;
      viewerRating: number | null;
      viewerComment: string | null;
    }[]
  >`
    SELECT
      (SELECT AVG(rating)::float8 FROM "Review"
        WHERE "recipeId" = ${recipeId}) AS average,
      (SELECT COUNT(*)::int FROM "Review"
        WHERE "recipeId" = ${recipeId}) AS "ratingCount",
      (SELECT COUNT(*)::int FROM "RecipeLike"
        WHERE "recipeId" = ${recipeId}) AS "likeCount",
      EXISTS (SELECT 1 FROM "RecipeLike"
        WHERE "recipeId" = ${recipeId} AND "userId" = ${viewerId ?? ""}) AS liked,
      v.rating AS "viewerRating", v.comment AS "viewerComment"
    FROM (SELECT 1) one
    LEFT JOIN "Review" v
      ON v."recipeId" = ${recipeId} AND v."userId" = ${viewerId ?? ""}`;
  return {
    rating: { average: row.average, count: row.ratingCount },
    likes: { count: row.likeCount, liked: row.liked },
    viewerReview:
      row.viewerRating === null
        ? null
        : { rating: row.viewerRating, comment: row.viewerComment },
  };
}

/** Cached per request so generateMetadata and the page share one query. */
export const getRecipe = cache(async (id: string) => {
  return prisma.recipe.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, name: true, isPrivate: true, privilegeLevel: true },
      },
      images: { orderBy: { position: "asc" } },
      ingredients: { orderBy: { position: "asc" } },
      steps: { orderBy: { position: "asc" } },
    },
  });
});

export type RecipeDetail = NonNullable<Awaited<ReturnType<typeof getRecipe>>>;

export type ListedReview = {
  id: string;
  authorId: string;
  authorName: string;
  authorLevel: number;
  authorBanned: boolean;
  authorPrivate: boolean;
  rating: number;
  comment: string;
  createdAt: Date;
  edited: boolean;
  moderated: boolean;
  likes: number;
  dislikes: number;
  viewerVote: VoteType | null;
};

/** US-4.5: only reviews with a comment, by score then newest. */
export async function getListedReviews(
  recipeId: string,
  viewer: Viewer,
): Promise<ListedReview[]> {
  const rows = await prisma.$queryRaw<
    (Omit<ListedReview, "authorPrivate"> & { authorIsPrivate: boolean })[]
  >`
    SELECT rv.id, rv."userId" AS "authorId", u.name AS "authorName",
      u."privilegeLevel" AS "authorLevel",
      u."bannedAt" IS NOT NULL AS "authorBanned",
      u."isPrivate" AS "authorIsPrivate",
      rv.rating, rv.comment, rv."createdAt",
      rv."editedAt" IS NOT NULL AS edited,
      rv."moderatedAt" IS NOT NULL AS moderated,
      (SELECT COUNT(*)::int FROM "ReviewVote" x
        WHERE x."reviewId" = rv.id AND x.type = 'LIKE') AS likes,
      (SELECT COUNT(*)::int FROM "ReviewVote" x
        WHERE x."reviewId" = rv.id AND x.type = 'DISLIKE') AS dislikes,
      (SELECT x.type::text FROM "ReviewVote" x
        WHERE x."reviewId" = rv.id AND x."userId" = ${viewer?.id ?? ""}) AS "viewerVote"
    FROM "Review" rv
    JOIN "User" u ON u.id = rv."userId"
    -- Reviews by private profiles are hidden (their ratings still count)
    WHERE rv."recipeId" = ${recipeId} AND rv.comment IS NOT NULL
      AND ${visibleUserSql(viewer, "u")}`;
  return rows
    .map(({ authorIsPrivate, ...r }) => ({
      ...r,
      authorPrivate: hasPrivateProfile({
        isPrivate: authorIsPrivate,
        level: r.authorLevel,
      }),
    }))
    .sort(compareReviews);
}

// ─────────────────────────────── Dashboard ───────────────────────────────

export const USERS_PAGE_SIZE = 25;

/** Accounts for the /admin dashboard, searchable by name or email. */
export async function getUsersPage(query: string, page: number) {
  const q = query.trim();
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ privilegeLevel: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        privilegeLevel: true,
        bannedAt: true,
        createdAt: true,
        _count: { select: { recipes: true, reviews: true } },
      },
    }),
  ]);
  return {
    users,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
  };
}
