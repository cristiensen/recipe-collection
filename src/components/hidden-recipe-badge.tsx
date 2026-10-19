import { EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Marks a recipe hidden from the public, for those who can still see it. */
export function HiddenRecipeBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1", className)}
      title="Only its author and chefs, moderators and admins can see this"
    >
      <EyeOff aria-hidden className="size-3" />
      Not public
    </Badge>
  );
}
