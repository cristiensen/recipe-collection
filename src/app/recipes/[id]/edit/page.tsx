import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form/recipe-form";
import { getRecipe } from "@/lib/data";
import { canEditRecipe } from "@/lib/rules";
import { requireUser } from "@/lib/session";
import { storageMode } from "@/lib/storage";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage(
  props: PageProps<"/recipes/[id]/edit">,
) {
  const { id } = await props.params;
  const user = await requireUser(`/recipes/${id}/edit`);
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  // BR-5: non-authors are sent back to the recipe (the action re-checks too).
  if (!canEditRecipe(user, recipe)) redirect(`/recipes/${id}`);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
        Edit recipe
      </h1>
      <RecipeForm
        recipeId={recipe.id}
        storage={storageMode()}
        initial={{
          title: recipe.title,
          description: recipe.description,
          cookingMinutes: recipe.cookingMinutes,
          servings: recipe.servings,
          labels: recipe.labels,
          images: recipe.images.map((i) => i.url),
          videoUrl: recipe.videoUrl,
          ingredients: recipe.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
          })),
          steps: recipe.steps.map((s) => ({ text: s.text })),
        }}
      />
    </div>
  );
}
