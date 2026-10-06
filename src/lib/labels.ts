import type { Label } from "@/generated/prisma/enums";

/** Predefined recipe labels (US-2.6). URL slugs are what appear in filter query strings. */
export const LABELS: readonly { value: Label; slug: string; name: string }[] = [
  { value: "VEGAN", slug: "vegan", name: "Vegan" },
  { value: "VEGETARIAN", slug: "vegetarian", name: "Vegetarian" },
  { value: "GLUTEN_FREE", slug: "gluten-free", name: "Gluten-free" },
  { value: "DAIRY_FREE", slug: "dairy-free", name: "Dairy-free" },
  { value: "SPICY", slug: "spicy", name: "Spicy" },
  { value: "DESSERT", slug: "dessert", name: "Dessert" },
  { value: "BREAKFAST", slug: "breakfast", name: "Breakfast" },
  { value: "QUICK", slug: "quick", name: "Quick" },
];

export const LABEL_VALUES = LABELS.map((l) => l.value) as [Label, ...Label[]];

export function labelName(value: Label): string {
  return LABELS.find((l) => l.value === value)?.name ?? value;
}

export function labelFromSlug(slug: string): Label | undefined {
  return LABELS.find((l) => l.slug === slug)?.value;
}

export function labelSlug(value: Label): string {
  return LABELS.find((l) => l.value === value)?.slug ?? value.toLowerCase();
}

/** How many label chips the browse filters show before "See all filters". */
export const MAX_VISIBLE_LABELS = 5;

/**
 * The label chips to show: the first `max`, plus any selected labels beyond
 * that so active filters are never hidden behind the dropdown.
 */
export function visibleLabelChips<T extends { value: Label }>(
  all: readonly T[],
  selected: readonly Label[],
  max: number,
): T[] {
  return all.filter((l, i) => i < max || selected.includes(l.value));
}

/** New recipes can have at most this many labels. */
export const MAX_LABELS = 7;

/**
 * How many labels a recipe may have. Recipes created before the limit keep
 * the labels they already had, so editing one never forces removing labels.
 */
export function labelLimit(existingCount = 0): number {
  return Math.max(MAX_LABELS, existingCount);
}

export function labelCountError(
  count: number,
  existingCount = 0,
): string | null {
  const limit = labelLimit(existingCount);
  return count > limit ? `Choose at most ${limit} labels` : null;
}
