"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Label } from "@/generated/prisma/enums";
import { LABELS, MAX_VISIBLE_LABELS, visibleLabelChips } from "@/lib/labels";
import {
  browseHref,
  type FeedFilters,
  hasActiveFilters,
  MAX_TIME_OPTIONS,
  MIN_RATING_OPTIONS,
  SORT_OPTIONS,
  type SortKey,
} from "@/lib/rules";

/**
 * Label, cooking-time and minimum-rating filters plus the sort order, kept
 * in the URL (US-3.2) alongside the header's search. Up to
 * MAX_VISIBLE_LABELS labels show as chips; the rest are in a searchable
 * "See all filters" dropdown.
 */
type Selection = FeedFilters & { sort: SortKey };

export function BrowseFilters({
  query,
  labels,
  maxTime,
  minRating,
  sort,
}: Selection) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Shows the new selection immediately; settles on the URL's filters once
  // the navigation finishes.
  const [filters, setOptimistic] = useOptimistic<Selection>({
    // Filtering keeps the search (only a new search resets the filters)
    query,
    labels,
    maxTime,
    minRating,
    sort,
  });
  const [open, setOpen] = useState(false);

  function apply(next: Selection) {
    startTransition(() => {
      setOptimistic(next);
      router.replace(browseHref(next), { scroll: false });
    });
  }

  function toggleLabel(label: Label) {
    const selected = filters.labels.includes(label)
      ? filters.labels.filter((l) => l !== label)
      : [...filters.labels, label];
    apply({ ...filters, labels: selected });
  }

  const chips = visibleLabelChips(LABELS, filters.labels, MAX_VISIBLE_LABELS);
  const hasMore = LABELS.length > MAX_VISIBLE_LABELS;
  const active = hasActiveFilters(filters);

  return (
    <section
      aria-label="Filter recipes"
      aria-busy={pending}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Labels</legend>
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((l) => (
            <label
              key={l.value}
              className="cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="checkbox"
                checked={filters.labels.includes(l.value)}
                onChange={() => toggleLabel(l.value)}
                className="sr-only"
              />
              {l.name}
            </label>
          ))}

          {hasMore && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  See all filters
                  <ChevronDown aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-0">
                <Command>
                  <CommandInput
                    placeholder="Search labels…"
                    aria-label="Search labels"
                  />
                  <CommandList label="All labels">
                    <CommandEmpty>No labels found.</CommandEmpty>
                    <CommandGroup>
                      {LABELS.map((l) => {
                        const checked = filters.labels.includes(l.value);
                        return (
                          <CommandItem
                            key={l.value}
                            value={l.name}
                            onSelect={() => toggleLabel(l.value)}
                            data-checked={checked}
                            aria-checked={checked}
                          >
                            {l.name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sort" className="text-sm font-medium">
            Sort by
          </label>
          <select
            id="sort"
            value={filters.sort}
            onChange={(e) =>
              apply({ ...filters, sort: e.target.value as SortKey })
            }
            className="h-9 rounded-md border bg-background px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="maxTime" className="text-sm font-medium">
            Max cooking time
          </label>
          <select
            id="maxTime"
            value={filters.maxTime?.toString() ?? ""}
            onChange={(e) =>
              apply({
                ...filters,
                maxTime: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="h-9 rounded-md border bg-background px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">Any</option>
            {MAX_TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t} min or less
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="minRating" className="text-sm font-medium">
            Minimum rating
          </label>
          <select
            id="minRating"
            value={filters.minRating?.toString() ?? ""}
            onChange={(e) =>
              apply({
                ...filters,
                minRating: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="h-9 rounded-md border bg-background px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">Any</option>
            {MIN_RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              // Sorting doesn't narrow the list, so it's kept
              apply({ ...filters, labels: [], maxTime: null, minRating: null })
            }
          >
            Clear filters
          </Button>
        )}
      </div>
    </section>
  );
}
