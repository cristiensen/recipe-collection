"use client";

import { Ban, Trash2, UserCheck } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  deleteUserAccount,
  type ModerationResult,
  setUserBanned,
  setUserLevel,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LEVELS, levelName } from "@/lib/privileges";

/** Level picker and ban/delete buttons for one account on the dashboard. */
export function UserRowActions({
  user,
  canSetLevel,
  canBan,
  canDelete,
}: {
  user: { id: string; name: string; level: number; banned: boolean };
  canSetLevel: boolean;
  canBan: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ModerationResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      {canSetLevel ? (
        <select
          aria-label={`Privilege level for ${user.name}`}
          value={user.level}
          disabled={pending}
          onChange={(e) => {
            const level = Number(e.target.value);
            run(
              () => setUserLevel(user.id, level),
              `${user.name} is now ${levelName(level).toLowerCase()}`,
            );
          }}
          className="h-8 rounded-md border bg-background px-2 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              {l.name} ({l.level})
            </option>
          ))}
        </select>
      ) : (
        <span className="text-sm">
          {levelName(user.level)} ({user.level})
        </span>
      )}

      {canBan && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => setUserBanned(user.id, !user.banned),
              user.banned
                ? `${user.name} was unbanned`
                : `${user.name} was banned`,
            )
          }
        >
          {user.banned ? <UserCheck aria-hidden /> : <Ban aria-hidden />}
          {user.banned ? "Unban" : "Ban"}
        </Button>
      )}

      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={pending}>
              <Trash2 aria-hidden /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {user.name}&apos;s account?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the account with all of its recipes
                (and their photos and videos), reviews and votes. This
                can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  run(
                    () => deleteUserAccount(user.id),
                    `${user.name}'s account was deleted`,
                  )
                }
              >
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
