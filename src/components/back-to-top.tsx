"use client";

import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Scroll distance (px) after which the button appears. */
const SHOW_AFTER = 200;
/** Pages that get the button: the recipe browsing page. */
const PAGES = new Set(["/"]);

/** Whether "Back to top" applies right now, and the action itself. */
export function useBackToTop() {
  const pathname = usePathname();
  const enabled = PAGES.has(pathname);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > SHOW_AFTER);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update(); // e.g. the browser restored a scroll position on Back
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  function scrollToTop() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // This button hides at the top, so give keyboard focus a sensible home
    const heading = document.querySelector<HTMLElement>("main h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  return { enabled, visible, scrollToTop };
}

/**
 * "Back to top" button for the header. Fades in once the user has scrolled
 * down, smoothly scrolls back up, and hides again at the top.
 */
export function BackToTop() {
  const { enabled, visible, scrollToTop } = useBackToTop();
  if (!enabled) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={scrollToTop}
      aria-label="Back to top"
      // Hidden state also removes it from the tab order and accessibility tree
      className={cn(
        "transition-[opacity,translate,visibility] duration-200 motion-reduce:transition-none",
        visible
          ? "visible translate-y-0 opacity-100"
          : "invisible -translate-y-1 opacity-0",
      )}
    >
      <ArrowUp aria-hidden />
      <span className="hidden sm:inline">Back to top</span>
    </Button>
  );
}
