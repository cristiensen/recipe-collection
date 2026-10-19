"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { setRecipeVisibility } from "@/app/actions/recipes";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * The author's "Public" switch for a recipe. Updates instantly and rolls back
 * with a message if the server rejects it.
 */
export function RecipeVisibilitySwitch({
  recipeId,
  title,
  isPublic: initial,
  label = "Public",
  disabled = false,
  className,
}: {
  recipeId: string;
  title: string;
  isPublic: boolean;
  /** The visible label (the switch's accessible name always names the recipe). */
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [isPublic, setIsPublic] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(isPublic);
  const [pending, startTransition] = useTransition();
  const id = `visibility-${recipeId}`;

  function change(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);
      const result = await setRecipeVisibility(recipeId, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIsPublic(result.isPublic);
      toast.success(
        result.isPublic
          ? `“${title}” is now public`
          : `“${title}” is now hidden from the public`,
      );
    });
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Switch
        id={id}
        checked={optimistic}
        onCheckedChange={change}
        disabled={pending || disabled}
        aria-label={`${title} is public`}
      />
      <label htmlFor={id} className="cursor-pointer text-sm font-medium">
        {label}
      </label>
    </div>
  );
}
