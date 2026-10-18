"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { labelFromSlug } from "@/lib/labels";
import {
  browseHref,
  MAX_QUERY_LENGTH,
  normalizeQuery,
  parseBrowseFilters,
} from "@/lib/rules";

/** How long typing must pause before the results update. */
const DEBOUNCE_MS = 250;

const FORM_CLASS = "w-full max-w-md";

/**
 * The header's recipe search. Results on the browse page update as you type;
 * a new search drops the label, time and rating filters (the sort is kept).
 * From any other page, typing opens the browse page with the results.
 */
export function RecipeSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onBrowse = pathname === "/";
  const urlQuery = onBrowse ? (searchParams.get("q") ?? "") : "";

  const [pending, startTransition] = useTransition();
  // From the first keystroke until the box loses focus
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(urlQuery);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The page a search was opened from, while still on it: later keystrokes
  // replace that new history entry instead of adding more
  const leftFrom = useRef<string | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // While you type, the box shows what you typed; otherwise it follows the
  // URL (Back/Forward, the logo link, opening a recipe)
  const shown = editing || pending ? value : urlQuery;

  function search(text: string) {
    clearTimeout(timer.current);
    timer.current = undefined;
    const query = normalizeQuery(text);
    const leaving = leftFrom.current === pathname;
    if (!onBrowse && !leaving && !query) return;
    if (onBrowse && query === urlQuery) return;
    const { sort } = parseBrowseFilters(
      onBrowse ? Object.fromEntries(searchParams) : {},
      labelFromSlug,
    );
    const href = browseHref({
      query,
      labels: [],
      maxTime: null,
      minRating: null,
      sort,
    });
    startTransition(() => {
      if (onBrowse || leaving) {
        router.replace(href, { scroll: false });
      } else {
        leftFrom.current = pathname;
        router.push(href);
      }
    });
  }

  function change(text: string) {
    setEditing(true);
    setValue(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(text), DEBOUNCE_MS);
  }

  return (
    <search className={FORM_CLASS}>
      <form
        action="/"
        onSubmit={(e) => {
          e.preventDefault();
          search(value);
        }}
      >
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            ref={input}
            type="search"
            name="q"
            value={shown}
            onChange={(e) => change(e.target.value)}
            onBlur={() => {
              setEditing(false);
              // Don't drop a search that was still waiting for the pause
              if (timer.current !== undefined) search(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && value) {
                e.preventDefault();
                change("");
              }
            }}
            placeholder="Search recipes…"
            aria-label="Search recipes"
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            // The browser's own clear button; ours below is always styled
            className="[&::-webkit-search-cancel-button]:hidden"
          />
          {shown && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => {
                  change("");
                  search("");
                  input.current?.focus();
                }}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </form>
    </search>
  );
}

/** Shown until the search can read the URL; works as a plain form meanwhile. */
export function RecipeSearchFallback() {
  return (
    <search className={FORM_CLASS}>
      <form action="/">
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="q"
            placeholder="Search recipes…"
            aria-label="Search recipes"
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            className="[&::-webkit-search-cancel-button]:hidden"
          />
        </InputGroup>
      </form>
    </search>
  );
}
