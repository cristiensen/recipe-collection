"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveReview } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type FieldErrors,
  MAX_COMMENT_LENGTH,
  reviewSchema,
  toFieldErrors,
} from "@/lib/validation";

/** Leave a review, or edit the existing one (US-4.1, US-4.2, US-4.4). */
export function ReviewForm({
  recipeId,
  existing,
}: {
  recipeId: string;
  existing: { rating: number; comment: string | null } | null;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { rating: rating || Number.NaN, comment };
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveReview(recipeId, input);
      if (result.ok) {
        toast.success(existing ? "Review updated" : "Thanks for your review!");
      } else {
        setErrors(result.errors);
        if (result.errors._form) toast.error(result.errors._form);
      }
    });
  }

  const remaining = MAX_COMMENT_LENGTH - comment.trim().length;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <h3 className="font-semibold">
        {existing ? "Your review" : "Rate this recipe"}
      </h3>
      {errors._form && (
        <p role="alert" className="text-sm text-destructive">
          {errors._form}
        </p>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}
              </span>
              <Star
                aria-hidden
                className={cn(
                  "size-7 transition-colors",
                  n <= rating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/50",
                )}
              />
            </label>
          ))}
        </div>
        {errors.rating && (
          <p className="text-sm text-destructive">{errors.rating}</p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-comment">Comment (optional)</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          aria-invalid={!!errors.comment}
          aria-describedby="review-comment-help"
          placeholder="How did it turn out? Any tips?"
        />
        <p
          id="review-comment-help"
          className={cn(
            "text-xs text-muted-foreground",
            remaining < 0 && "text-destructive",
          )}
        >
          {errors.comment ??
            (remaining < 200
              ? `${remaining} characters left`
              : "Ratings without a comment count toward the average but aren't listed.")}
        </p>
      </div>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : existing ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}
