import "server-only";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import type { Label, VoteType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  type Actor,
  hasPrivateProfile,
  isStaff,
  LEVEL,
} from "@/lib/privileges";
import { compareReviews, type FeedFilters, type SortKey } from "@/lib/rules";

export type RecipeCardData = {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  coverUrl: string | null;
  cookingMinutes: number;
  labels: Label[];
  averageRating: number | null;
  ratingCount: number;
  likeCount: number;
  /** Whether the current viewer has liked it (false for guests). */
  liked: boolean;
  /** Its author's profile is private (only they and staff can see it). */
  authorPrivate: boolean;
};

/** The person looking at the page (null for guests). */
type Viewer = Actor | null;

/**
 * Prisma filter for users whose content the viewer may see: public profiles,
 * the viewer's own, or everything for staff (see `canSeeContentOf`).
 */
function visibleUserWhere(viewer: Viewer): Prisma.UserWhereInput {
  if (isStaff(viewer)) return {};
  return {
    OR: [
      { isPrivate: false },
      { privilegeLevel: { lt: LEVEL.CHEF } },
      ...(viewer ? [{ id: viewer.id }] : []),
    ],
  };
}

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

/**
 * FROM + WHERE for the browse feed. It's SQL rather than a Prisma query
 * because sorting and filtering by average rating need the aggregate; every
 * value is passed as a query parameter.
 */
function feedQuery(filters: FeedFilters, viewer: Viewer) {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (!isStaff(viewer)) {
    // Same rule as visibleUserWhere: hide recipes whose author is private
    conditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM "User" a
      WHERE a.id = r."authorId" AND a."isPrivate"
        AND a."privilegeLevel" >= ${LEVEL.CHEF}
        AND a.id <> ${viewer?.id ?? ""}
    )`);
  }
  // US-3.2: a recipe must have *all* selected labels
  if (filters.labels.length > 0) {
    conditions.push(Prisma.sql`r.labels @> ${filters.labels}::"Label"[]`);
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
    LEFT JOIN (
      SELECT "recipeId", AVG(rating) AS avg FROM "Review" GROUP BY "recipeId"
    ) s ON s."recipeId" = r.id
    WHERE ${Prisma.join(conditions, " AND ")}`;
}

export async function countRecipes(filters: FeedFilters, viewer: Viewer) {
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count ${feedQuery(filters, viewer)}`;
  return row?.count ?? 0;
}

/** The first `take` recipe cards matching the filters, in the chosen order. */
export async function getRecipeFeed(
  filters: FeedFilters,
  sort: SortKey,
  take: number,
  viewer: Viewer,
) {
  const ordered = await prisma.$queryRaw<{ id: string }[]>`
    SELECT r.id ${feedQuery(filters, viewer)}
    ORDER BY ${ORDER_BY[sort]}
    LIMIT ${take}`;
  return recipeCards(
    ordered.map((r) => r.id),
    viewer?.id ?? null,
  );
}

/** Card data for recipes, in the order of `ids`. */
async function recipeCards(
  ids: string[],
  viewerId: string | null,
): Promise<RecipeCardData[]> {
  if (ids.length === 0) return [];
  const [rows, stats, likes] = await Promise.all([
    prisma.recipe.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        cookingMinutes: true,
        labels: true,
        authorId: true,
        author: {
          select: { name: true, isPrivate: true, privilegeLevel: true },
        },
        images: {
          orderBy: { position: "asc" },
          take: 1,
          select: { url: true },
        },
      },
    }),
    ratingStats(ids),
    likeStats(ids, viewerId),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id): RecipeCardData[] => {
    const r = byId.get(id);
    if (!r) return []; // deleted between the two queries
    return [
      {
        id: r.id,
        title: r.title,
        authorId: r.authorId,
        authorName: r.author.name,
        coverUrl: r.images[0]?.url ?? null,
        cookingMinutes: r.cookingMinutes,
        labels: r.labels,
        averageRating: stats.get(r.id)?.average ?? null,
        ratingCount: stats.get(r.id)?.count ?? 0,
        likeCount: likes.counts.get(r.id) ?? 0,
        liked: likes.likedByViewer.has(r.id),
        authorPrivate: hasPrivateProfile({
          isPrivate: r.author.isPrivate,
          level: r.author.privilegeLevel,
        }),
      },
    ];
  });
}

// ──────────────────────────────── Profiles ────────────────────────────────

/** Public profile header: who they are and a few numbers. */
export const getUserProfile = cache(async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      privilegeLevel: true,
      isPrivate: true,
      createdAt: true,
      _count: { select: { recipes: true, reviews: true } },
    },
  });
  if (!user) return null;
  const likesReceived = await prisma.recipeLike.count({
    where: { recipe: { authorId: userId } },
  });
  return {
    id: user.id,
    name: user.name,
    level: user.privilegeLevel,
    /** The saved setting (shown in Settings). */
    isPrivate: user.isPrivate,
    memberSince: user.createdAt,
    recipeCount: user._count.recipes,
    reviewCount: user._count.reviews,
    likesReceived,
  };
});

/** Recipes a user published, newest first. */
/** (Callers check the profile is visible first.) */
export async function getUserRecipes(
  userId: string,
  take: number,
  viewer: Viewer,
) {
  const [rows, total] = await Promise.all([
    prisma.recipe.findMany({
      where: { authorId: userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      select: { id: true },
    }),
    prisma.recipe.count({ where: { authorId: userId } }),
  ]);
  const recipes = await recipeCards(
    rows.map((r) => r.id),
    viewer?.id ?? null,
  );
  return { recipes, total };
}

/** Recipes a user liked, most recently liked first. */
export async function getLikedRecipes(
  userId: string,
  take: number,
  viewer: Viewer,
) {
  const where: Prisma.RecipeLikeWhereInput = {
    userId,
    recipe: { author: visibleUserWhere(viewer) },
  };
  const [rows, total] = await Promise.all([
    prisma.recipeLike.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { recipeId: "desc" }],
      take,
      select: { recipeId: true },
    }),
    prisma.recipeLike.count({ where }),
  ]);
  const recipes = await recipeCards(
    rows.map((r) => r.recipeId),
    viewer?.id ?? null,
  );
  return { recipes, total };
}

/** BR-9: every rating counts, whether or not it has a comment. */
/** Like counts for some recipes, and which of them the viewer has liked. */
async function likeStats(recipeIds: string[], viewerId: string | null) {
  const [groups, mine] = await Promise.all([
    prisma.recipeLike.groupBy({
      by: ["recipeId"],
      where: { recipeId: { in: recipeIds } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.recipeLike.findMany({
          where: { recipeId: { in: recipeIds }, userId: viewerId },
          select: { recipeId: true },
        })
      : [],
  ]);
  return {
    counts: new Map(groups.map((g) => [g.recipeId, g._count._all])),
    likedByViewer: new Set(mine.map((l) => l.recipeId)),
  };
}

export async function getLikeSummary(
  recipeId: string,
  viewerId: string | null,
) {
  const stats = await likeStats([recipeId], viewerId);
  return {
    count: stats.counts.get(recipeId) ?? 0,
    liked: stats.likedByViewer.has(recipeId),
  };
}

async function ratingStats(recipeIds: string[]) {
  const map = new Map<string, { average: number; count: number }>();
  if (recipeIds.length === 0) return map;
  const groups = await prisma.review.groupBy({
    by: ["recipeId"],
    where: { recipeId: { in: recipeIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const g of groups) {
    map.set(g.recipeId, { average: g._avg.rating ?? 0, count: g._count._all });
  }
  return map;
}

export async function getRatingSummary(recipeId: string) {
  const stats = await ratingStats([recipeId]);
  const s = stats.get(recipeId);
  return { average: s?.average ?? null, count: s?.count ?? 0 };
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
  const viewerId = viewer?.id ?? null;
  const reviews = await prisma.review.findMany({
    // Reviews by private profiles are hidden (their ratings still count)
    where: { recipeId, comment: { not: null }, user: visibleUserWhere(viewer) },
    include: {
      user: {
        select: {
          name: true,
          privilegeLevel: true,
          bannedAt: true,
          isPrivate: true,
        },
      },
    },
  });
  if (reviews.length === 0) return [];
  const ids = reviews.map((r) => r.id);

  const [tallies, viewerVotes] = await Promise.all([
    prisma.reviewVote.groupBy({
      by: ["reviewId", "type"],
      where: { reviewId: { in: ids } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.reviewVote.findMany({
          where: { reviewId: { in: ids }, userId: viewerId },
          select: { reviewId: true, type: true },
        })
      : [],
  ]);

  const count = (reviewId: string, type: VoteType) =>
    tallies.find((t) => t.reviewId === reviewId && t.type === type)?._count
      ._all ?? 0;

  return reviews
    .map((r) => ({
      id: r.id,
      authorId: r.userId,
      authorName: r.user.name,
      authorLevel: r.user.privilegeLevel,
      authorBanned: r.user.bannedAt !== null,
      authorPrivate: hasPrivateProfile({
        isPrivate: r.user.isPrivate,
        level: r.user.privilegeLevel,
      }),
      rating: r.rating,
      comment: r.comment ?? "",
      createdAt: r.createdAt,
      edited: r.editedAt !== null,
      moderated: r.moderatedAt !== null,
      likes: count(r.id, "LIKE"),
      dislikes: count(r.id, "DISLIKE"),
      viewerVote: viewerVotes.find((v) => v.reviewId === r.id)?.type ?? null,
    }))
    .sort(compareReviews);
}

export async function getViewerReview(recipeId: string, userId: string) {
  return prisma.review.findUnique({
    where: { recipeId_userId: { recipeId, userId } },
    select: { rating: true, comment: true },
  });
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
