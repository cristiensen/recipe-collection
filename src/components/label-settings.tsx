"use client";

import { Search, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteLabel } from "@/app/actions/labels";
import { CreateLabelForm } from "@/components/create-label-form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { ManagedLabel } from "@/lib/data";
import { MAX_TOTAL_LABELS } from "@/lib/labels";

/** How many labels the list shows at once (search finds the others). */
const SHOWN_LABELS = 8;

/**
 * Settings → Labels (chefs and up): create labels and delete them. Chefs see
 * their own labels, deletable for a few minutes; admins see and can delete
 * every label.
 */
export function LabelSettings({
  labels,
  totalCount,
  canCreate,
  isAdmin,
  windowMinutes,
}: {
  labels: ManagedLabel[];
  /** All labels on the site (for the limit). */
  totalCount: number;
  canCreate: boolean;
  isAdmin: boolean;
  windowMinutes: number;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? labels.filter((l) => l.name.toLowerCase().includes(q))
    : labels;
  const shown = matches.slice(0, SHOWN_LABELS);

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Labels</h2>
        <p className="text-sm text-muted-foreground">
          Labels you add can be used by everyone to tag and filter recipes.{" "}
          {isAdmin
            ? "As an admin, you can delete any label."
            : `You can delete a label within ${windowMinutes} minutes of creating it.`}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {totalCount} of {MAX_TOTAL_LABELS} labels in use.
      </p>
      {canCreate &&
        (totalCount < MAX_TOTAL_LABELS ? (
          <CreateLabelForm id="settings-new-label" />
        ) : (
          <p className="text-sm text-muted-foreground">
            The label limit is reached, so no new labels can be added
            {isAdmin ? "." : " until an admin deletes some."}
          </p>
        ))}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          {isAdmin ? "All labels" : "Labels you created"}
        </h3>
        {labels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t created any labels yet.
          </p>
        ) : (
          <>
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search labels…"
                aria-label="Search labels"
                aria-controls="settings-labels"
                autoComplete="off"
              />
            </InputGroup>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No labels match “{query.trim()}”.
              </p>
            ) : (
              <ul
                id="settings-labels"
                className="flex flex-col divide-y rounded-lg border"
              >
                {shown.map((l) => (
                  <LabelRow key={l.slug} label={l} isAdmin={isAdmin} />
                ))}
              </ul>
            )}
            {matches.length > shown.length && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                Showing {shown.length} of {matches.length}
                {q ? " matching labels" : " labels"}. Search to find others.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function LabelRow({
  label,
  isAdmin,
}: {
  label: ManagedLabel;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const used =
    label.recipeCount === 1 ? "1 recipe" : `${label.recipeCount} recipes`;
  const details = [
    `Used on ${used}`,
    isAdmin && (label.creatorName ? `by ${label.creatorName}` : "built-in"),
    label.minutesLeft !== null &&
      `can be deleted for ${label.minutesLeft} more min`,
    !label.canDelete && "can no longer be deleted",
  ].filter(Boolean);

  function remove() {
    startTransition(async () => {
      const result = await deleteLabel(label.slug);
      if (result.ok) {
        toast.success(`Label “${label.name}” deleted`);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{label.name}</span>
        <span className="text-xs text-muted-foreground">
          {details.join(" · ")}
        </span>
      </div>
      {label.canDelete && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete label ${label.name}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{label.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {label.recipeCount === 1
                  ? "It will be removed from the recipe that uses it. "
                  : label.recipeCount > 1
                    ? `It will be removed from the ${used} that use it. `
                    : ""}
                This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={remove} disabled={pending}>
                {pending ? "Deleting…" : "Delete label"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  );
}
