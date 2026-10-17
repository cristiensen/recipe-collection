"use server";

import { revalidatePath } from "next/cache";
import { recipesChanged, userChanged } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import {
  canBanUser,
  canDeleteAccount,
  canModerateReview,
  canSetLevel,
} from "@/lib/privileges";
import { shouldClearVotes } from "@/lib/rules";
import { getCurrentUser } from "@/lib/session";
import { deleteMedia } from "@/lib/storage";
import { reviewSchema } from "@/lib/validation";

export type ModerationResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "You don't have permission to do that.";

async function loadReview(reviewId: string) {
  return prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      recipeId: true,
      comment: true,
      user: { select: { id: true, privilegeLevel: true } },
    },
  });
}

async function loadTarget(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, privilegeLevel: true },
  });
  return user ? { id: user.id, level: user.privilegeLevel } : null;
}

function revalidateRecipe(recipeId: string) {
  recipesChanged();
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/");
}

/** Moderators: rewrite another user's review comment (empty removes it, BR-10). */
export async function moderatorEditReview(
  reviewId: string,
  comment: unknown,
): Promise<ModerationResult> {
  const actor = await getCurrentUser();
  const review = await loadReview(reviewId);
  if (!review) return { ok: false, error: "This review no longer exists" };
  const reviewer = { id: review.user.id, level: review.user.privilegeLevel };
  if (!canModerateReview(actor, reviewer))
    return { ok: false, error: NOT_ALLOWED };

  const parsed = reviewSchema.shape.comment.safeParse(comment);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid comment",
    };
  }
  const next = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (shouldClearVotes(review.comment, next)) {
      await tx.reviewVote.deleteMany({ where: { reviewId } });
    }
    await tx.review.update({
      where: { id: reviewId },
      data: { comment: next, moderatedAt: new Date() },
    });
  });
  revalidateRecipe(review.recipeId);
  return { ok: true };
}

/** Moderators: delete another user's whole review (rating and votes too). */
export async function moderatorRemoveReview(
  reviewId: string,
): Promise<ModerationResult> {
  const actor = await getCurrentUser();
  const review = await loadReview(reviewId);
  if (!review) return { ok: false, error: "This review no longer exists" };
  const reviewer = { id: review.user.id, level: review.user.privilegeLevel };
  if (!canModerateReview(actor, reviewer))
    return { ok: false, error: NOT_ALLOWED };

  await prisma.review.delete({ where: { id: reviewId } });
  revalidateRecipe(review.recipeId);
  return { ok: true };
}

/** Moderators: ban (read-only) or unban a lower-level account. */
export async function setUserBanned(
  userId: string,
  banned: boolean,
): Promise<ModerationResult> {
  const actor = await getCurrentUser();
  const target = await loadTarget(userId);
  if (!target) return { ok: false, error: "This account no longer exists" };
  if (!canBanUser(actor, target)) return { ok: false, error: NOT_ALLOWED };

  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: banned ? new Date() : null },
  });
  userChanged(userId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admins: change a lower-level account's privilege level. */
export async function setUserLevel(
  userId: string,
  level: number,
): Promise<ModerationResult> {
  const actor = await getCurrentUser();
  const target = await loadTarget(userId);
  if (!target) return { ok: false, error: "This account no longer exists" };
  if (!canSetLevel(actor, target, level))
    return { ok: false, error: NOT_ALLOWED };

  await prisma.user.update({
    where: { id: userId },
    data: { privilegeLevel: level },
  });
  userChanged(userId);
  // Privacy only applies to chefs and up
  recipesChanged();
  revalidatePath("/admin");
  return { ok: true };
}

/** Admins: delete a lower-level account with all its recipes, reviews and votes. */
export async function deleteUserAccount(
  userId: string,
): Promise<ModerationResult> {
  const actor = await getCurrentUser();
  const target = await loadTarget(userId);
  if (!target) return { ok: false, error: "This account no longer exists" };
  if (!canDeleteAccount(actor, target))
    return { ok: false, error: NOT_ALLOWED };

  const recipes = await prisma.recipe.findMany({
    where: { authorId: userId },
    select: { videoUrl: true, images: { select: { url: true } } },
  });
  // Recipes, reviews, votes and sessions cascade in the database.
  await prisma.user.delete({ where: { id: userId } });
  await deleteMedia(
    recipes.flatMap((r) => [
      ...r.images.map((i) => i.url),
      ...(r.videoUrl ? [r.videoUrl] : []),
    ]),
  );
  userChanged(userId);
  recipesChanged();
  revalidatePath("/", "layout");
  return { ok: true };
}
