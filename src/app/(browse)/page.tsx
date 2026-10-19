import { SearchX } from "lucide-react";
import Link from "next/link";
import { BrowseFilters } from "@/components/browse-filters";
import { RecipeFeed } from "@/components/recipe-feed";
import { RecipeRow } from "@/components/recipe-row";
import { Button } from "@/components/ui/button";
import { getBrowseLists, getLabels } from "@/lib/data";
import { canCreateLabel, canCreateRecipe } from "@/lib/privileges";
import {
  browseHref,
  hasActiveFilters,
  MAX_SHOWN,
  PAGE_SIZE,
  parseBrowseFilters,
} from "@/lib/rules";
import { getCurrentUser } from "@/lib/session";
import { loginHref } from "@/lib/urls";

export default async function BrowsePage(props: PageProps<"/">) {
  const [params, allLabels, user] = await Promise.all([
    props.searchParams,
    getLabels(),
    getCurrentUser(),
  ]);
  // Render as many as were loaded before (`?shown=`), so Back restores the list
  const filters = parseBrowseFilters(params, (slug) =>
    allLabels.some((l) => l.slug === slug),
  );
  const viewer = user
    ? { id: user.id, level: user.level, banned: user.banned }
    : null;
  // The feed and the rows above it (which follow the filters, not the sort)
  const { recipes, total, loved, hottest } = await getBrowseLists(
    filters,
    viewer,
  );
  const loginUrl = loginHref(browseHref(filters));
  const filtered = hasActiveFilters(filters);
  const { query } = filters;
  const hasMore = recipes.length < total && filters.shown < MAX_SHOWN;
  // Search results come on their own, without the rows
  const hasRows = !query && (loved.length > 0 || hottest.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Browse recipes
        </h1>
        <p className="mt-1 text-muted-foreground">
          Home-cooked dishes from our community.
        </p>
      </div>

      <BrowseFilters
        query={query}
        labels={filters.labels}
        maxTime={filters.maxTime}
        minRating={filters.minRating}
        sort={filters.sort}
        allLabels={allLabels}
        canCreateLabels={canCreateLabel(user)}
      />

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <SearchX aria-hidden className="size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            {query
              ? `No recipes match “${query}”`
              : filtered
                ? "No recipes match these filters"
                : "No recipes yet"}
          </h2>
          <p className="max-w-sm text-muted-foreground">
            {query
              ? filtered
                ? "Check the spelling, try other words or remove some filters."
                : "Check the spelling or try other words."
              : filtered
                ? "Try removing a label, allowing a longer cooking time or lowering the minimum rating."
                : "Check back soon for something delicious."}
          </p>
          {query ? (
            <Button asChild variant="outline">
              <Link href={browseHref({ ...filters, query: "", shown: 0 })}>
                Clear search
              </Link>
            </Button>
          ) : filtered ? (
            <Button asChild variant="outline">
              <Link href="/">Clear filters</Link>
            </Button>
          ) : (
            canCreateRecipe(user) && (
              <Button asChild>
                <Link href="/recipes/new">Share a recipe</Link>
              </Button>
            )
          )}
        </div>
      ) : (
        <>
          {/* Row recipes are always among the results, so rows need no empty state */}
          {hasRows && viewer && loved.length > 0 && (
            <RecipeRow
              title="What you love"
              recipes={loved}
              viewer={viewer}
              loginUrl={loginUrl}
            />
          )}
          {hasRows && hottest.length > 0 && (
            <RecipeRow
              title="Hottest this week"
              recipes={hottest}
              viewer={viewer}
              loginUrl={loginUrl}
            />
          )}
          {query ? (
            <h2
              className="text-xl font-semibold tracking-tight"
              aria-live="polite"
            >
              {total === 1 ? "1 recipe" : `${total} recipes`} matching “{query}”
            </h2>
          ) : (
            hasRows && (
              <h2 className="text-xl font-semibold tracking-tight">
                All recipes
              </h2>
            )
          )}
          <RecipeFeed
            // A new filter or sort starts a fresh list (fresh focus/loading state)
            key={browseHref(filters)}
            recipes={recipes}
            moreHref={
              hasMore
                ? browseHref({ ...filters, shown: filters.shown + PAGE_SIZE })
                : null
            }
            capped={recipes.length < total && !hasMore}
            viewer={viewer}
            loginUrl={loginUrl}
          />
        </>
      )}
    </div>
  );
}
