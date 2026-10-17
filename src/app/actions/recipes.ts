"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recipesChanged } from "@/lib/cache";
import { labelCountError } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canCreateRecipe, READ_ONLY_MESSAGE } from "@/lib/privileges";
import { canEditRecipe } from "@/lib/rules";
import { getCurrentUser } from "@/lib/session";
import { deleteMedia } from "@/lib/storage";
import {
  type FieldErrors,
  type RecipeData,
  recipeSchema,
  toFieldErrors,
} from "@/lib/validation";

export type RecipeActionResult = { ok: false; errors: FieldErrors };

const SAVE_FAILED =
  "We couldn't save your recipe, so nothing was published. Please try again.";

function childRows(d: RecipeData) {
  return {
    images: d.images.map((url, position) => ({ url, position })),
    ingredients: d.ingredients.map((i, position) => ({ ...i, position })),
    steps: d.steps.map((s, position) => ({ text: s.text, position })),
  };
}

function scalarFields(d: RecipeData) {
  return {
    title: d.title,
    description: d.description,
    cookingMinutes: d.cookingMinutes,
    servings: d.servings,
    labels: d.labels,
    videoUrl: d.videoUrl,
  };
}

export async function createRecipe(
  input: unknown,
): Promise<RecipeActionResult> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      errors: { _form: "Please log in to publish a recipe" },
    };

  if (!canCreateRecipe(user)) {
    return {
      ok: false,
      errors: {
        _form: user.banned
          ? READ_ONLY_MESSAGE
          : "Only chefs can publish recipes. Ask an admin for chef access.",
      },
    };
  }

  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, errors: toFieldErrors(parsed.error) };
  const tooMany = labelCountError(parsed.data.labels.length);
  if (tooMany) return { ok: false, errors: { labels: tooMany } };

  const rows = childRows(parsed.data);
  let id: string;
  try {
    // BR-4: a nested create is one transaction — all parts are saved or none are.
    const recipe = await prisma.recipe.create({
      data: {
        ...scalarFields(parsed.data),
        authorId: user.id,
        images: { create: rows.images },
        ingredients: { create: rows.ingredients },
        steps: { create: rows.steps },
      },
      select: { id: true },
    });
    id = recipe.id;
  } catch (e) {
    console.error("createRecipe failed", e);
    return { ok: false, errors: { _form: SAVE_FAILED } };
  }

  recipesChanged();
  revalidatePath("/");
  redirect(`/recipes/${id}`);
}

export async function updateRecipe(
  recipeId: string,
  input: unknown,
): Promise<RecipeActionResult> {
  const user = await getCurrentUser();
  if (!user)
    return { ok: false, errors: { _form: "Please log in to edit recipes" } };

  const existing = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      authorId: true,
      videoUrl: true,
      labels: true,
      images: { select: { url: true } },
    },
  });
  if (!existing)
    return { ok: false, errors: { _form: "This recipe no longer exists" } };
  // BR-5
  if (!canEditRecipe(user, existing)) {
    return {
      ok: false,
      errors: {
        _form: user.banned
          ? READ_ONLY_MESSAGE
          : "You can only edit your own recipes",
      },
    };
  }

  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, errors: toFieldErrors(parsed.error) };
  // Older recipes may keep more labels than the limit, but not add more
  const tooMany = labelCountError(
    parsed.data.labels.length,
    existing.labels.length,
  );
  if (tooMany) return { ok: false, errors: { labels: tooMany } };

  const rows = childRows(parsed.data);
  try {
    // BR-4: replace children inside one transaction.
    await prisma.$transaction([
      prisma.recipeImage.deleteMany({ where: { recipeId } }),
      prisma.ingredient.deleteMany({ where: { recipeId } }),
      prisma.step.deleteMany({ where: { recipeId } }),
      prisma.recipe.update({
        where: { id: recipeId },
        data: {
          ...scalarFields(parsed.data),
          images: { create: rows.images },
          ingredients: { create: rows.ingredients },
          steps: { create: rows.steps },
        },
      }),
    ]);
  } catch (e) {
    console.error("updateRecipe failed", e);
    return {
      ok: false,
      errors: {
        _form: "We couldn't save your changes. Your recipe is unchanged.",
      },
    };
  }

  const kept = new Set([...parsed.data.images, parsed.data.videoUrl]);
  const oldMedia = [...existing.images.map((i) => i.url), existing.videoUrl];
  await deleteMedia(oldMedia.filter((u): u is string => !!u && !kept.has(u)));

  recipesChanged();
  revalidatePath("/");
  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}`);
}

export async function deleteRecipe(
  recipeId: string,
): Promise<{ ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in to delete recipes" };

  const existing = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      authorId: true,
      videoUrl: true,
      images: { select: { url: true } },
    },
  });
  if (!existing) return { ok: false, error: "This recipe no longer exists" };
  // BR-5
  if (!canEditRecipe(user, existing)) {
    return {
      ok: false,
      error: user.banned
        ? READ_ONLY_MESSAGE
        : "You can only delete your own recipes",
    };
  }

  // Ingredients, steps, images, reviews and votes cascade in the database.
  await prisma.recipe.delete({ where: { id: recipeId } });
  const media = [...existing.images.map((i) => i.url), existing.videoUrl];
  await deleteMedia(media.filter((u): u is string => !!u));

  recipesChanged();
  revalidatePath("/");
  redirect("/");
}
