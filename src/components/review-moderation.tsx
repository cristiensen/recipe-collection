"use client";

import { Ban, MoreHorizontal, Pencil, Trash2, UserCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type ModerationResult,
  moderatorEditReview,
  moderatorRemoveReview,
  setUserBanned,
} from "@/app/actions/moderation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_COMMENT_LENGTH } from "@/lib/validation";

/** Moderator tools for one review. Only rendered when the server allows it. */
export function ReviewModeration({
  reviewId,
  reviewerId,
  reviewerName,
  reviewerBanned,
  comment,
  canBan,
}: {
  reviewId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerBanned: boolean;
  comment: string;
  canBan: boolean;
}) {
  const [dialog, setDialog] = useState<"edit" | "remove" | null>(null);
  const [draft, setDraft] = useState(comment);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ModerationResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        setDialog(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Moderate review by ${reviewerName}`}
            disabled={pending}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(comment);
              setDialog("edit");
            }}
          >
            <Pencil /> Edit comment
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDialog("remove")}
          >
            <Trash2 /> Remove review
          </DropdownMenuItem>
          {canBan && (
            <DropdownMenuItem
              onSelect={() =>
                run(
                  () => setUserBanned(reviewerId, !reviewerBanned),
                  reviewerBanned
                    ? `${reviewerName} was unbanned`
                    : `${reviewerName} was banned (read-only)`,
                )
              }
            >
              {reviewerBanned ? <UserCheck /> : <Ban />}
              {reviewerBanned ? "Unban reviewer" : "Ban reviewer"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialog === "edit"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {reviewerName}&apos;s comment</DialogTitle>
            <DialogDescription>
              The review will be marked &ldquo;edited by a moderator&rdquo;.
              Clearing the comment hides the review but keeps its rating.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`moderate-${reviewId}`}>Comment</Label>
            <Textarea
              id={`moderate-${reviewId}`}
              value={draft}
              maxLength={MAX_COMMENT_LENGTH}
              rows={5}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => moderatorEditReview(reviewId, draft),
                  "Comment updated",
                )
              }
            >
              {pending ? "Saving…" : "Save comment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={dialog === "remove"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {reviewerName}&apos;s review?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The comment, the star rating and its votes are deleted, and the
              rating no longer counts toward the average. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                run(() => moderatorRemoveReview(reviewId), "Review removed");
              }}
            >
              Remove review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
