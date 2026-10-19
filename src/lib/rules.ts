import type { VoteType } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/privileges";

/**
 * Permission and business rules (BR-5, BR-8, BR-9, BR-10, BR-12) as pure
 * functions, so the Server Actions and the UI make the same decisions and
 * the rules are unit-testable without a database. Privilege-level rules live
 * in privileges.ts.
 */

/**
 * BR-5: only the author can edit or delete a recipe. Authors keep this for
 * their own recipes at any level; banned (read-only) accounts can't.
 */
export function canEditRecipe(
  actor: Actor | null,
  recipe: { authorId: string },
) {
  return !!actor && !actor.banned && actor.id === recipe.authorId;
}

/** BR-8: logged-in, non-banned users can review recipes they did not write. */
export function canReviewRecipe(
  actor: Actor | null,
  recipe: { authorId: string },
) {
  return !!actor && !actor.banned && actor.id !== recipe.authorId;
}

/**
 * Hearts: logged-in, non-banned users can like recipes they didn't write
 * (like reviews and votes, no liking your own).
 */
export function canLikeRecipe(
  actor: Actor | null,
  recipe: { authorId: string },
) {
  return !!actor && !actor.banned && actor.id !== recipe.authorId;
}

/** What the heart button does for this viewer on this recipe. */
export function likeMode(
  actor: Actor | null,
  recipe: { authorId: string },
): "guest" | "own" | "readonly" | "liker" {
  if (!actor) return "guest";
  if (actor.banned) return "readonly";
  if (actor.id === recipe.authorId) return "own";
  return "liker";
}

/** BR-9: only reviews with a comment are listed (and therefore votable). */
export function isListedReview(review: { comment: string | null }) {
  return review.comment !== null && review.comment.trim() !== "";
}

/** BR-12: users cannot vote on their own review, nor on unlisted reviews. */
export function canVoteOnReview(
  actor: Actor | null,
  review: { userId: string; comment: string | null },
) {
  return (
    !!actor &&
    !actor.banned &&
    actor.id !== review.userId &&
    isListedReview(review)
  );
}

/** BR-10: removing a review's comment clears its votes. */
export function shouldClearVotes(
  previousComment: string | null,
  nextComment: string | null,
) {
  return previousComment !== null && nextComment === null;
}

// ───────────────────────────────── Votes ─────────────────────────────────

/** US-5.1: same button removes the vote; the other button switches it. */
export function nextVote(
  current: VoteType | null,
  clicked: VoteType,
): VoteType | null {
  return current === clicked ? null : clicked;
}

export type VoteTally = { likes: number; dislikes: number };

export function applyVoteChange(
  tally: VoteTally,
  from: VoteType | null,
  to: VoteType | null,
): VoteTally {
  const next = { ...tally };
  if (from === "LIKE") next.likes--;
  if (from === "DISLIKE") next.dislikes--;
  if (to === "LIKE") next.likes++;
  if (to === "DISLIKE") next.dislikes++;
  return next;
}

/** US-4.5: by score (likes − dislikes), then newest first. */
export function compareReviews(
  a: VoteTally & { createdAt: Date },
  b: VoteTally & { createdAt: Date },
) {
  const byScore = b.likes - b.dislikes - (a.likes - a.dislikes);
  return byScore !== 0
    ? byScore
    : b.createdAt.getTime() - a.createdAt.getTime();
}

// ──────────────────────────── Browse filters ────────────────────────────

/** Recipes per "Load more" batch. */
export const PAGE_SIZE = 12;
/** Upper bound for `?shown=` so a crafted URL can't request everything at once. */
export const MAX_SHOWN = 240;
export const MAX_TIME_OPTIONS = [15, 30, 60] as const;
/** Sort orders for the browse page; the first is the default (US-3.1). */
export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "rating-desc", label: "Highest rated" },
  { value: "rating-asc", label: "Lowest rated" },
  { value: "time-asc", label: "Shortest cooking time" },
  { value: "time-desc", label: "Longest cooking time" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];
export const DEFAULT_SORT: SortKey = "newest";

function parseSort(value: string | undefined): SortKey {
  return SORT_OPTIONS.find((o) => o.value === value)?.value ?? DEFAULT_SORT;
}

/** Minimum average rating filter: 1, 1.5, … 5. */
export const MIN_RATING_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

/** Longest search accepted from the URL. */
export const MAX_QUERY_LENGTH = 100;

/** A search as it's stored in the URL: trimmed, single-spaced and capped. */
export function normalizeQuery(value: string | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

export type BrowseFilters = {
  /** Words every result must contain (title, description or ingredients). */
  query: string;
  /** Label slugs a recipe must all have. */
  labels: string[];
  maxTime: number | null;
  /** Only recipes whose average rating is at least this (unrated ones excluded). */
  minRating: number | null;
  sort: SortKey;
  /** How many recipes are loaded (grows by PAGE_SIZE with each "Load more"). */
  shown: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Rounds up to whole batches and clamps to [PAGE_SIZE, MAX_SHOWN]. */
export function clampShown(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= PAGE_SIZE) return PAGE_SIZE;
  return Math.min(MAX_SHOWN, Math.ceil(n / PAGE_SIZE) * PAGE_SIZE);
}

/**
 * US-3.2: filters live in the URL (`?q=pasta&labels=vegan,spicy&maxTime=30`), plus
 * `shown=24` once "Load more" was used, so Back and shared links restore the list.
 */
export function parseBrowseFilters(
  params: SearchParams,
  isLabel: (slug: string) => boolean,
): BrowseFilters {
  // Accepts `labels=vegan,spicy` and repeated `labels=vegan&labels=spicy`.
  const labels = [
    ...new Set(
      [params.labels ?? []]
        .flat()
        .flatMap((v) => v.split(","))
        .map((s) => s.trim())
        .filter(isLabel),
    ),
  ];
  const time = Number(first(params.maxTime));
  const maxTime = (MAX_TIME_OPTIONS as readonly number[]).includes(time)
    ? time
    : null;
  const rating = Number(first(params.minRating));
  const minRating = (MIN_RATING_OPTIONS as readonly number[]).includes(rating)
    ? rating
    : null;
  return {
    query: normalizeQuery(first(params.q)),
    labels,
    maxTime,
    minRating,
    sort: parseSort(first(params.sort)),
    shown: clampShown(first(params.shown)),
  };
}

/** What narrows the list (everything except how many are shown). */
export type FeedFilters = Pick<
  BrowseFilters,
  "labels" | "maxTime" | "minRating"
> & { query?: string };

/** Whether labels, cooking time or rating narrow the list (search aside). */
export function hasActiveFilters(filters: FeedFilters) {
  return (
    filters.labels.length > 0 ||
    filters.maxTime !== null ||
    filters.minRating !== null
  );
}

/** The browse URL for a set of filters (labels as one comma-separated param). */
export function browseHref(
  filters: FeedFilters & { sort?: SortKey; shown?: number },
): string {
  const params = new URLSearchParams();
  const query = normalizeQuery(filters.query);
  if (query) params.set("q", query);
  if (filters.labels.length > 0) {
    params.set("labels", filters.labels.join(","));
  }
  if (filters.maxTime) params.set("maxTime", String(filters.maxTime));
  if (filters.minRating) params.set("minRating", String(filters.minRating));
  if (filters.sort && filters.sort !== DEFAULT_SORT) {
    params.set("sort", filters.sort);
  }
  if (filters.shown && filters.shown > PAGE_SIZE) {
    params.set("shown", String(filters.shown));
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
