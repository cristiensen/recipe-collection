"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RecipeCard } from "@/components/recipe-card";
import { Button } from "@/components/ui/button";
import type { RecipeCardData } from "@/lib/data";
import type { Actor } from "@/lib/privileges";

/** Cover image width of a row card (its `w-64 sm:w-72`). */
const CARD_SIZES = "(min-width: 640px) 18rem, 16rem";

/**
 * A titled, horizontally scrolling row of recipe cards (e.g. "What you
 * love"). Swipe or scroll sideways; on larger screens arrow buttons on its
 * edges page through it, and the mouse wheel scrolls it while hovered.
 * Callers leave the row out when it has no recipes.
 */
export function RecipeRow({
  title,
  recipes,
  viewer,
  loginUrl,
}: {
  title: string;
  recipes: RecipeCardData[];
  viewer: Actor | null;
  /** Where guests go when they click a heart. */
  loginUrl: string;
}) {
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  const update = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    // 1px slack: scroll positions can be fractional at some zoom levels
    setCanScroll({
      back: list.scrollLeft > 1,
      forward: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-observe the cards when they change (e.g. after an unlike)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    for (const item of list.children) observer.observe(item);
    list.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, [update, recipes]);

  // A vertical wheel scrolls the row sideways while hovered, freely (no
  // snapping); at either end the wheel falls through to the page so it never
  // traps the pointer. Non-passive so preventDefault can stop the page
  // scrolling meanwhile.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    function onWheel(event: WheelEvent) {
      if (!list || event.ctrlKey || event.shiftKey) return;
      // Horizontal trackpad swipes already scroll the row natively
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * list.clientWidth
            : event.deltaY;
      const atStart = list.scrollLeft <= 1;
      const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
      event.preventDefault();
      list.scrollLeft += delta;
    }
    list.addEventListener("wheel", onWheel, { passive: false });
    return () => list.removeEventListener("wheel", onWheel);
  }, []);

  /** Brings the next card over (in `direction`) to the row's center. */
  function scrollPage(direction: 1 | -1) {
    const list = listRef.current;
    if (!list) return;
    const at = list.scrollLeft;
    const max = list.scrollWidth - list.clientWidth;
    const listLeft = list.getBoundingClientRect().left;
    // Where the row would sit with each card centered; cards near the ends
    // can't reach the center, so those stops clamp to the ends
    const stops = [...list.children].map((item) => {
      const box = item.getBoundingClientRect();
      const center = box.left - listLeft + at + box.width / 2;
      return Math.min(max, Math.max(0, center - list.clientWidth / 2));
    });
    // Stops run left to right, so the first one past here is the next card
    const target =
      direction > 0
        ? stops.find((stop) => stop > at + 1)
        : stops.findLast((stop) => stop < at - 1);
    if (target === undefined) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    list.scrollTo({
      left: target,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="relative">
        {/* The padding keeps card shadows and focus rings from being clipped */}
        <ul
          ref={listRef}
          className="-mx-1 flex scroll-px-1 gap-4 overflow-x-auto px-1 pt-1 pb-3"
        >
          {recipes.map((r) => (
            <li key={r.id} className="w-64 shrink-0 sm:w-72">
              <RecipeCard
                recipe={r}
                viewer={viewer}
                loginUrl={loginUrl}
                sizes={CARD_SIZES}
                titleAs="h3"
                className="h-full"
              />
            </li>
          ))}
        </ul>
        {/* Touch screens swipe instead; keyboard users tab through the cards.
            The bars span the cards' height and sit flush with the list's
            edges, which stick out past this wrapper (its -mx-1) */}
        {canScroll.back && (
          <Button
            variant="default"
            onClick={() => scrollPage(-1)}
            aria-label={`Scroll ${title} back`}
            className="absolute top-1 bottom-3 -left-1 hidden h-auto w-12 rounded-none border-0 rounded-r-xl bg-neutral-800/60 px-0 text-white hover:bg-neutral-800/80 sm:inline-flex"
          >
            <ChevronLeft aria-hidden className="size-7" />
          </Button>
        )}
        {canScroll.forward && (
          <Button
            variant="default"
            onClick={() => scrollPage(1)}
            aria-label={`Scroll ${title} forward`}
            className="absolute top-1 bottom-3 -right-1 hidden h-auto w-12 rounded-none border-0 rounded-l-xl bg-neutral-800/60 px-0 text-white hover:bg-neutral-800/80 sm:inline-flex"
          >
            <ChevronRight aria-hidden className="size-7" />
          </Button>
        )}
      </div>
    </section>
  );
}
