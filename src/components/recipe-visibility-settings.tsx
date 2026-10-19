import Link from "next/link";
import { HiddenRecipeBadge } from "@/components/hidden-recipe-badge";
import { RecipeVisibilitySwitch } from "@/components/recipe-visibility-switch";

/**
 * Settings → Recipe visibility (authors): show or hide each of their recipes
 * from the public. Chefs, moderators and admins still see hidden ones.
 */
export function RecipeVisibilitySettings({
  recipes,
  canChange,
}: {
  recipes: { id: string; title: string; isPublic: boolean }[];
  /** False for banned (read-only) accounts. */
  canChange: boolean;
}) {
  const hidden = recipes.filter((r) => !r.isPublic).length;
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Recipe visibility</h2>
        <p className="text-sm text-muted-foreground">
          Turn a recipe off to hide it from the public. You, chefs, moderators
          and admins can still see it.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {hidden === 0
          ? "All your recipes are public."
          : `${hidden} of ${recipes.length} ${recipes.length === 1 ? "recipe is" : "recipes are"} hidden from the public.`}
      </p>
      <ul className="flex max-h-96 flex-col divide-y overflow-y-auto rounded-lg border">
        {recipes.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/recipes/${r.id}`}
                className="truncate text-sm font-medium hover:underline"
              >
                {r.title}
              </Link>
              {!r.isPublic && <HiddenRecipeBadge className="shrink-0" />}
            </div>
            <RecipeVisibilitySwitch
              key={String(r.isPublic)}
              recipeId={r.id}
              title={r.title}
              isPublic={r.isPublic}
              disabled={!canChange}
              className="shrink-0"
            />
          </li>
        ))}
      </ul>
      {!canChange && (
        <p className="text-sm text-muted-foreground">
          Your account is read-only, so this can&apos;t be changed.
        </p>
      )}
    </section>
  );
}
