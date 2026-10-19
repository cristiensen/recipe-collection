/**
 * A recipe label (US-2.6). The slug is its key: recipes store it and filter
 * URLs use it. Labels live in the database: a few built-in ones, plus those
 * chefs and up create (see `getLabels`).
 */
export type LabelOption = { slug: string; name: string };

export const MAX_LABEL_NAME_LENGTH = 30;

/** At most this many labels in total (built-in ones included), so the
 * filters stay usable. */
export const MAX_TOTAL_LABELS = 100;

/**
 * The slug for a label name: "Gluten Free!" → "gluten-free", "Crème brûlée"
 * → "creme-brulee". Empty when the name has no letters or digits.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The names of `slugs`, in their order (deleted labels are left out). */
export function labelNames(
  slugs: readonly string[],
  all: readonly LabelOption[],
): string[] {
  return slugs.flatMap((s) => all.find((l) => l.slug === s)?.name ?? []);
}

/** How many label chips the browse filters show before "See all filters". */
export const MAX_VISIBLE_LABELS = 5;

/**
 * The label chips to show: the first `max`, plus any selected labels beyond
 * that so active filters are never hidden behind the dropdown.
 */
export function visibleLabelChips<T extends { slug: string }>(
  all: readonly T[],
  selected: readonly string[],
  max: number,
): T[] {
  return all.filter((l, i) => i < max || selected.includes(l.slug));
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
