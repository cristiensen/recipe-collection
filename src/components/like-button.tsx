"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { setRecipeLike } from "@/app/actions/likes";
import { cn } from "@/lib/utils";

export type LikeMode = "guest" | "own" | "readonly" | "liker";

type LikeState = { liked: boolean; count: number };

/**
 * Heart button for a recipe: an outline when not liked, filled when liked.
 * Updates instantly and rolls back with a message if the server rejects it.
 * `overlay` sits on top of a photo (browse cards); `inline` sits in text.
 */
export function LikeButton({
  recipeId,
  title,
  initial,
  mode,
  loginUrl,
  variant = "inline",
  className,
}: {
  recipeId: string;
  title: string;
  initial: LikeState;
  mode: LikeMode;
  loginUrl: string;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const [state, setState] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [pending, startTransition] = useTransition();

  // Why the viewer can't like, shown when they click (not only on hover)
  const blockedReason =
    mode === "own"
      ? "You can't like your own recipe"
      : mode === "readonly"
        ? "Your account is read-only"
        : null;

  function toggle() {
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }
    const next = !optimistic.liked;
    startTransition(async () => {
      setOptimistic({
        liked: next,
        count: optimistic.count + (next ? 1 : -1),
      });
      const result = await setRecipeLike(recipeId, next);
      if (result.ok) setState({ liked: result.liked, count: result.count });
      else toast.error(result.error);
    });
  }

  const { liked, count } = optimistic;
  const label = `Like ${title} (${count} ${count === 1 ? "like" : "likes"})`;
  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-full text-sm font-medium tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
    variant === "overlay"
      ? "bg-background/85 px-2.5 py-1 text-foreground shadow-sm backdrop-blur hover:bg-background"
      : "px-2 py-1 hover:bg-muted",
    className,
  );
  const content = (
    <>
      <Heart
        aria-hidden
        className={cn(
          "size-4 transition-transform motion-safe:active:scale-90",
          liked && "fill-red-500 text-red-500",
        )}
      />
      <span>{count}</span>
    </>
  );

  if (mode === "guest") {
    return (
      <Link
        href={loginUrl}
        aria-label={`${label} — log in to like`}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Not `disabled`: it stays clickable so the click can explain why
      aria-disabled={blockedReason ? true : undefined}
      aria-pressed={liked}
      aria-busy={pending}
      aria-label={label}
      title={blockedReason ?? undefined}
      className={classes}
    >
      {content}
    </button>
  );
}
