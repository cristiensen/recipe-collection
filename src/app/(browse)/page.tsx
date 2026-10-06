import { SearchX } from "lucide-react";
import Link from "next/link";
import { BrowseFilters } from "@/components/browse-filters";
import { RecipeFeed } from "@/components/recipe-feed";
import { Button } from "@/components/ui/button";
import { countRecipes, getRecipeFeed } from "@/lib/data";
import { labelFromSlug } from "@/lib/labels";
import { canCreateRecipe } from "@/lib/privileges";
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
  const filters = parseBrowseFilters(await props.searchParams, labelFromSlug);
  // Render as many as were loaded before (`?shown=`), so Back restores the list
  const user = await getCurrentUser();
  const viewer = user
    ? { id: user.id, level: user.level, banned: user.banned }
    : null;
  const [recipes, total] = await Promise.all([
    getRecipeFeed(filters, filters.sort, filters.shown, viewer),
    countRecipes(filters, viewer),
  ]);
  const filtered = hasActiveFilters(filters);
  const hasMore = recipes.length < total && filters.shown < MAX_SHOWN;

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
        labels={filters.labels}
        maxTime={filters.maxTime}
        minRating={filters.minRating}
        sort={filters.sort}
      />

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <SearchX aria-hidden className="size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            {filtered ? "No recipes match these filters" : "No recipes yet"}
          </h2>
          <p className="max-w-sm text-muted-foreground">
            {filtered
              ? "Try removing a label, allowing a longer cooking time or lowering the minimum rating."
              : "Check back soon for something delicious."}
          </p>
          {filtered ? (
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
          loginUrl={loginHref(browseHref(filters))}
        />
      )}
    </div>
  );
}
