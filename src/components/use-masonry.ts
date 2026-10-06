"use client";

import { type RefObject, useLayoutEffect } from "react";

/**
 * Masonry layout on top of a normal CSS grid: every item keeps its natural
 * height, and items stack with an equal `gap` vertically and horizontally.
 *
 * The grid switches to 1px rows (`data-masonry="on"`) and each item spans as
 * many rows as its height plus the gap. CSS grid's auto-placement then puts
 * each item, in DOM order, into the column that frees up first (the shortest),
 * so reading/tab order stays left-to-right and appended items never move the
 * existing ones. Until measured (server render), it's a regular grid.
 */
export function useMasonry(
  listRef: RefObject<HTMLElement | null>,
  gap: number,
  itemCount: number,
) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || itemCount === 0) return;
    const items = Array.from(list.children) as HTMLElement[];

    const layout = (item: HTMLElement) => {
      const content = item.firstElementChild as HTMLElement | null;
      if (!content) return;
      const span = Math.ceil(content.getBoundingClientRect().height + gap);
      item.style.gridRowEnd = `span ${span}`;
    };

    for (const item of items) layout(item);
    list.dataset.masonry = "on";

    // Re-measure when a card's height changes (resize, fonts, wrapping)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const item = entry.target.parentElement;
        if (item) layout(item);
      }
    });
    for (const item of items) {
      if (item.firstElementChild) observer.observe(item.firstElementChild);
    }
    return () => observer.disconnect();
  }, [listRef, gap, itemCount]);
}
