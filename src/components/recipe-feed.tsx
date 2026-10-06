"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { RecipeCard } from "@/components/recipe-card";
import { Button } from "@/components/ui/button";
import { useMasonry } from "@/components/use-masonry";
import type { RecipeCardData } from "@/lib/data";
import type { Actor } from "@/lib/privileges";
import { PAGE_SIZE } from "@/lib/rules";

/** Space between cards in px; must match the grid's `gap-4`. */
const GRID_GAP = 16;

/**
 * Index of the first newly loaded card, so keyboard focus can move there.
 * Kept at module level because the page (and this component) can remount when
 * the URL's `shown` changes.
 */
let focusFromIndex: number | null = null;

/**
 * A masonry grid of recipe cards with a "Load more" button. Loading more is a
 * navigation to `moreHref` (the same page with a bigger `?shown=`, without
 * scrolling), so the server renders the longer list and Next.js keeps *that*
 * page for Back/Forward, reloads and shared links. Used by browse and profiles.
 */
export function RecipeFeed({
  recipes,
  moreHref,
  capped = false,
  viewer,
  loginUrl,
}: {
  recipes: RecipeCardData[];
  /** Link that loads the next batch, or null when everything is shown. */
  moreHref: string | null;
  /** More exist but the list hit its size cap (shows a hint instead). */
  capped?: boolean;
  viewer: Actor | null;
  /** Where guests go when they click a heart. */
  loginUrl: string;
}) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const from = focusFromIndex;
    if (from === null || recipes.length <= from) return;
    // The new page may still be being revealed when this runs, so retry for a
    // few frames until the card can actually take focus.
    let frame = 0;
    let handle = 0;
    const tryFocus = () => {
      const link =
        listRef.current?.querySelectorAll<HTMLAnchorElement>("li h2 a")[from];
      link?.focus();
      if (link && document.activeElement === link) {
        focusFromIndex = null;
      } else if (++frame < 30) {
        handle = requestAnimationFrame(tryFocus);
      }
    };
    tryFocus();
    return () => cancelAnimationFrame(handle);
  }, [recipes.length]);

  useMasonry(listRef, GRID_GAP, recipes.length);

  function loadMore() {
    focusFromIndex = recipes.length;
    startTransition(() => {
      if (moreHref) router.replace(moreHref, { scroll: false });
    });
  }

  return (
    <>
      {/* Masonry: cards keep their own height with equal 16px gaps all round */}
      <ul
        ref={listRef}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 data-[masonry=on]:auto-rows-[1px] data-[masonry=on]:gap-y-0"
      >
        {recipes.map((r, i) => (
          <li key={r.id}>
            <div>
              <RecipeCard
                recipe={r}
                viewer={viewer}
                loginUrl={loginUrl}
                priority={i < 3}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-2 py-2">
        {moreHref ? (
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={pending}
            aria-busy={pending}
            className="min-w-40"
          >
            {pending && <Loader2 aria-hidden className="animate-spin" />}
            {pending ? "Loading…" : "Load more"}
          </Button>
        ) : capped ? (
          <p className="text-sm text-muted-foreground">
            Use the filters to narrow down the remaining recipes.
          </p>
        ) : (
          recipes.length > PAGE_SIZE && (
            <p className="text-sm text-muted-foreground">
              You&apos;ve reached the end.
            </p>
          )
        )}
      </div>
    </>
  );
}
