"use server";

import { revalidatePath } from "next/cache";
import { recipesChanged } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { canSeeRecipe, READ_ONLY_MESSAGE } from "@/lib/privileges";
import { canLikeRecipe } from "@/lib/rules";
import { getCurrentUser } from "@/lib/session";

export type LikeResult =
  | { ok: true; liked: boolean; count: number }
  | { ok: false; error: string };

/**
 * Sets whether the viewer likes a recipe. Takes the desired state rather than
 * "toggle", so double clicks or two open tabs can't flip it the wrong way.
 */
export async function setRecipeLike(
  recipeId: string,
  liked: boolean,
): Promise<LikeResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in to like recipes" };

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      authorId: true,
      isPublic: true,
      author: { select: { id: true, isPrivate: true, privilegeLevel: true } },
    },
  });
  // Private authors' and hidden recipes look deleted to those who can't see them
  if (
    !recipe ||
    !canSeeRecipe(user, {
      isPublic: recipe.isPublic,
      author: {
        id: recipe.author.id,
        isPrivate: recipe.author.isPrivate,
        level: recipe.author.privilegeLevel,
      },
    })
  ) {
    return { ok: false, error: "This recipe no longer exists" };
  }
  if (!canLikeRecipe(user, recipe)) {
    return {
      ok: false,
      error: user.banned ? READ_ONLY_MESSAGE : "You can't like your own recipe",
    };
  }

  try {
    if (liked) {
      // One like per user per recipe (primary key); repeating it is a no-op
      await prisma.recipeLike.createMany({
        data: [{ recipeId, userId: user.id }],
        skipDuplicates: true,
      });
    } else {
      await prisma.recipeLike.deleteMany({
        where: { recipeId, userId: user.id },
      });
    }
    const count = await prisma.recipeLike.count({ where: { recipeId } });
    // Keep Back/Forward copies of these pages in sync with the new state
    recipesChanged();
    revalidatePath("/");
    revalidatePath(`/recipes/${recipeId}`);
    return { ok: true, liked, count };
  } catch (e) {
    console.error("setRecipeLike failed", e);
    return { ok: false, error: "Your like wasn't saved. Please try again." };
  }
}
