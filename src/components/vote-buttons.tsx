"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { voteOnReview } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import type { VoteType } from "@/generated/prisma/enums";
import { applyVoteChange, nextVote } from "@/lib/rules";
import { cn } from "@/lib/utils";

type VoteState = { likes: number; dislikes: number; vote: VoteType | null };

/**
 * Like/dislike with instant feedback (US-5.1). The optimistic state reverts
 * automatically if the server rejects the vote, and an error toast is shown.
 */
export function VoteButtons({
  reviewId,
  initial,
  mode,
  loginUrl,
}: {
  reviewId: string;
  initial: VoteState;
  mode: "guest" | "own" | "readonly" | "voter";
  loginUrl: string;
}) {
  const [state, setState] = useState(initial);
  const [optimistic, applyOptimistic] = useOptimistic(
    state,
    (current: VoteState, clicked: VoteType): VoteState => {
      const vote = nextVote(current.vote, clicked);
      return { ...applyVoteChange(current, current.vote, vote), vote };
    },
  );
  const [pending, startTransition] = useTransition();

  function click(type: VoteType) {
    startTransition(async () => {
      applyOptimistic(type);
      const result = await voteOnReview(reviewId, type);
      if (result.ok) {
        setState({
          likes: result.likes,
          dislikes: result.dislikes,
          vote: result.vote,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  const buttons = [
    {
      type: "LIKE" as const,
      Icon: ThumbsUp,
      count: optimistic.likes,
      label: "Like",
    },
    {
      type: "DISLIKE" as const,
      Icon: ThumbsDown,
      count: optimistic.dislikes,
      label: "Dislike",
    },
  ];

  return (
    <div className="flex items-center gap-1" aria-busy={pending}>
      {buttons.map(({ type, Icon, count, label }) => {
        const active = optimistic.vote === type;
        const content = (
          <>
            <Icon aria-hidden className={cn(active && "fill-current")} />
            <span className="tabular-nums">{count}</span>
          </>
        );
        const ariaLabel = `${label} (${count})`;
        const className = cn(active && "bg-primary/10 text-primary");

        if (mode === "guest") {
          return (
            <Button
              key={type}
              asChild
              variant="ghost"
              size="sm"
              className={className}
            >
              <Link
                href={loginUrl}
                aria-label={`${ariaLabel} — log in to vote`}
              >
                {content}
              </Link>
            </Button>
          );
        }
        return (
          <Button
            key={type}
            type="button"
            variant="ghost"
            size="sm"
            className={className}
            disabled={mode === "own" || mode === "readonly"}
            title={
              mode === "own"
                ? "You can't vote on your own review"
                : mode === "readonly"
                  ? "Your account is read-only"
                  : undefined
            }
            aria-label={ariaLabel}
            aria-pressed={active}
            onClick={() => click(type)}
          >
            {content}
          </Button>
        );
      })}
    </div>
  );
}
