import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Marks private content for the only people who can see it: owner and staff. */
export function PrivateBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1", className)}
      title="Only the owner, moderators and admins can see this"
    >
      <Lock aria-hidden className="size-3" />
      Private
    </Badge>
  );
}
