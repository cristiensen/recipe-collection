import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

/** Tag on cached data built from recipes, their likes and reviews, or who
 * can see them. */
const RECIPES_TAG = "recipes";

/** Tag on a cached account (see `getCurrentUser`). */
export const userTag = (userId: string) => `user:${userId}`;

/**
 * `load()`, cached across requests in production under `key` (which must
 * name everything `load` depends on) until a tag is invalidated or
 * `revalidate` seconds pass. Development, and the e2e tests that run against
 * it and edit the database directly, always read fresh data. The result is
 * stored as JSON, so it must not contain Dates.
 */
export function cached<T>(
  load: () => Promise<T>,
  key: string[],
  { tags, revalidate }: { tags: string[]; revalidate: number },
): Promise<T> {
  if (process.env.NODE_ENV !== "production") return load();
  return unstable_cache(load, key, { tags, revalidate })();
}

/** Like `cached`, for data that changes with recipes, likes, reviews or
 * profile visibility. */
export function cachedRecipeData<T>(load: () => Promise<T>, key: string[]) {
  // Views change all the time and invalidate nothing, so "hottest" rows can
  // lag by up to this long
  return cached(load, key, { tags: [RECIPES_TAG], revalidate: 300 });
}

/**
 * Call after changing recipes, likes, reviews or profile visibility. The next
 * request reads fresh data (callable from Server Actions and Route Handlers).
 */
export function recipesChanged() {
  revalidateTag(RECIPES_TAG, { expire: 0 });
}

/** Call after changing an account's name, level, ban, theme, or deleting it. */
export function userChanged(userId: string) {
  revalidateTag(userTag(userId), { expire: 0 });
}
