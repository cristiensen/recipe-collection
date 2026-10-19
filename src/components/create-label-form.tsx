"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  createLabel,
  deleteLabel,
  type LabelFormState,
} from "@/app/actions/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LabelOption, MAX_LABEL_NAME_LENGTH } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Name field + "Add label" for chefs and up (Settings and the browse
 * filters). The success toast offers Undo, which deletes it again.
 */
export function CreateLabelForm({
  id,
  onCreated,
  autoFocus = false,
  className,
}: {
  /** The name input's id (two forms can be on one page). */
  id: string;
  onCreated?: (label: LabelOption) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<LabelFormState, FormData>(
    createLabel,
    undefined,
  );

  // Each result is handled once, however often the parent re-renders
  const handled = useRef<LabelFormState>(undefined);
  useEffect(() => {
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    const { slug } = state.label;
    formRef.current?.reset();
    toast.success(state.message, {
      action: {
        label: "Undo",
        onClick: async () => {
          const result = await deleteLabel(slug);
          if (result.ok) toast.success("Label removed");
          else toast.error(result.error);
        },
      },
    });
    onCreated?.(state.label);
  }, [state, onCreated]);

  const errors = state && !state.ok ? state.errors : {};
  const error = errors.name ?? errors._form;
  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label htmlFor={id}>New label</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name="name"
          placeholder="e.g. Low-carb"
          maxLength={MAX_LABEL_NAME_LENGTH}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          <Plus aria-hidden />
          {pending ? "Adding…" : "Add label"}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
