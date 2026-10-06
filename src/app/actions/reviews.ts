"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { VoteType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { canSeeContentOf, READ_ONLY_MESSAGE } from "@/lib/privileges";
import {
  canReviewRecipe,
  canVoteOnReview,
  nextVote,
  shouldClearVotes,
} from "@/lib/rules";
import { getCurrentUser } from "@/lib/session";
import {
  type FieldErrors,
  reviewSchema,
  toFieldErrors,
} from "@/lib/validation";

export type ReviewActionResult =
  | { ok: true }
  | { ok: false; errors: FieldErrors };

/** Creates the viewer's review, or edits it if one exists (US-4.1, US-4.2, US-4.4). */
export async function saveReview(
  recipeId: string,
  input: unknown,
): Promise<ReviewActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: { _form: "Please log in to review" } };

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      authorId: true,
      author: { select: { id: true, isPrivate: true, privilegeLevel: true } },
    },
  });
  if (
    !recipe ||
    !canSeeContentOf(user, {
      id: recipe.author.id,
      isPrivate: recipe.author.isPrivate,
      level: recipe.author.privilegeLevel,
    })
  )
    return { ok: false, errors: { _form: "This recipe no longer exists" } };
  // BR-8
  if (!canReviewRecipe(user, recipe)) {
    return {
      ok: false,
      errors: {
        _form: user.banned
          ? READ_ONLY_MESSAGE
          : "You can't review your own recipe",
      },
    };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, errors: toFieldErrors(parsed.error) };
  const { rating, comment } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.review.findUnique({
        where: { recipeId_userId: { recipeId, userId: user.id } },
        select: { id: true, rating: true, comment: true },
      });
      if (!existing) {
        // BR-7 is also enforced by the unique (recipeId, userId) constraint.
        await tx.review.create({
          data: { recipeId, userId: user.id, rating, comment },
        });
        return;
      }
      // BR-10
      if (shouldClearVotes(existing.comment, comment)) {
        await tx.reviewVote.deleteMany({ where: { reviewId: existing.id } });
      }
      const changed =
        existing.rating !== rating || existing.comment !== comment;
      await tx.review.update({
        where: { id: existing.id },
        data: { rating, comment, ...(changed && { editedAt: new Date() }) },
      });
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        errors: {
          _form: "You've already reviewed this recipe. Reload to edit it.",
        },
      };
    }
    console.error("saveReview failed", e);
    return {
      ok: false,
      errors: { _form: "We couldn't save your review. Please try again." },
    };
  }

  // US-4.1: the average updates immediately.
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/");
  return { ok: true };
}

export type VoteResult =
  | { ok: true; vote: VoteType | null; likes: number; dislikes: number }
  | { ok: false; error: string };

/** Toggles the viewer's like/dislike on a review (US-5.1, US-5.2). */
export async function voteOnReview(
  reviewId: string,
  clicked: VoteType,
): Promise<VoteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in to vote" };
  if (clicked !== VoteType.LIKE && clicked !== VoteType.DISLIKE) {
    return { ok: false, error: "Invalid vote" };
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      userId: true,
      comment: true,
      user: { select: { id: true, isPrivate: true, privilegeLevel: true } },
      recipe: {
        select: {
          author: {
            select: { id: true, isPrivate: true, privilegeLevel: true },
          },
        },
      },
    },
  });
  // Hidden reviews (private reviewer) and reviews on hidden recipes look deleted
  if (
    !review ||
    !canSeeContentOf(user, {
      id: review.user.id,
      isPrivate: review.user.isPrivate,
      level: review.user.privilegeLevel,
    }) ||
    !canSeeContentOf(user, {
      id: review.recipe.author.id,
      isPrivate: review.recipe.author.isPrivate,
      level: review.recipe.author.privilegeLevel,
    })
  ) {
    return { ok: false, error: "This review no longer exists" };
  }
  // BR-12 (and only listed reviews can be voted on)
  if (!canVoteOnReview(user, review)) {
    return {
      ok: false,
      error: user.banned ? READ_ONLY_MESSAGE : "You can't vote on this review",
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const key = { reviewId_userId: { reviewId, userId: user.id } };
      const current = await tx.reviewVote.findUnique({ where: key });
      const vote = nextVote(current?.type ?? null, clicked);
      if (vote === null) {
        await tx.reviewVote.delete({ where: key });
      } else {
        // BR-11: (reviewId, userId) is the primary key.
        await tx.reviewVote.upsert({
          where: key,
          create: { reviewId, userId: user.id, type: vote },
          update: { type: vote },
        });
      }
      const likes = await tx.reviewVote.count({
        where: { reviewId, type: "LIKE" },
      });
      const dislikes = await tx.reviewVote.count({
        where: { reviewId, type: "DISLIKE" },
      });
      return { ok: true as const, vote, likes, dislikes };
    });
  } catch (e) {
    console.error("voteOnReview failed", e);
    return { ok: false, error: "Your vote wasn't saved. Please try again." };
  }
}
