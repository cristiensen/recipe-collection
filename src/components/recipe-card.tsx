import { Clock, ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LikeButton } from "@/components/like-button";
import { PrivateBadge } from "@/components/private-badge";
import { Stars } from "@/components/stars";
import { Badge } from "@/components/ui/badge";
import type { RecipeCardData } from "@/lib/data";
import { formatMinutes, formatRatingSummary } from "@/lib/format";
import { labelName } from "@/lib/labels";
import type { Actor } from "@/lib/privileges";
import { likeMode } from "@/lib/rules";
import { cn } from "@/lib/utils";

/** Image widths for cards in the responsive grid (one, two or three columns). */
const GRID_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export function RecipeCard({
  recipe,
  viewer,
  loginUrl,
  priority = false,
  sizes = GRID_SIZES,
  titleAs: Title = "h2",
  className,
}: {
  recipe: RecipeCardData;
  viewer: Actor | null;
  /** Where guests go when they click the heart (returns them here after). */
  loginUrl: string;
  priority?: boolean;
  /** The cover image's `sizes`, for cards that aren't in the grid. */
  sizes?: string;
  /** h3 when the card sits under a section heading (e.g. in a row). */
  titleAs?: "h2" | "h3";
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-[4/3] bg-muted">
        {recipe.coverUrl ? (
          <Image
            src={recipe.coverUrl}
            alt={recipe.title}
            fill
            sizes={sizes}
            className="object-cover"
            priority={priority}
          />
        ) : (
          <ImageOff className="absolute inset-0 m-auto size-8 text-muted-foreground" />
        )}
        {/* Above the card-wide link, so it can be clicked without opening the recipe */}
        <LikeButton
          key={`${recipe.liked}:${recipe.likeCount}`}
          recipeId={recipe.id}
          title={recipe.title}
          initial={{ liked: recipe.liked, count: recipe.likeCount }}
          mode={likeMode(viewer, recipe)}
          loginUrl={loginUrl}
          variant="overlay"
          className="absolute top-2 right-2 z-10"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {recipe.authorPrivate && <PrivateBadge className="w-fit" />}
        <Title className="line-clamp-2 font-semibold leading-snug">
          <Link
            href={`/recipes/${recipe.id}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {recipe.title}
          </Link>
        </Title>
        <p className="text-sm text-muted-foreground">
          by{" "}
          {/* Above the card-wide link, so it opens the profile, not the recipe */}
          <Link
            href={`/users/${recipe.authorId}`}
            className="relative z-10 hover:text-foreground hover:underline"
          >
            {recipe.authorName}
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="gap-1">
            <Clock aria-hidden className="size-3" />
            {formatMinutes(recipe.cookingMinutes)}
          </Badge>
          {recipe.labels.map((l) => (
            <Badge key={l} variant="outline">
              {labelName(l)}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1 text-sm">
          {recipe.ratingCount > 0 && recipe.averageRating !== null && (
            <Stars value={recipe.averageRating} />
          )}
          <span className="text-muted-foreground">
            {formatRatingSummary(recipe.averageRating, recipe.ratingCount)}
          </span>
        </div>
      </div>
    </article>
  );
}
