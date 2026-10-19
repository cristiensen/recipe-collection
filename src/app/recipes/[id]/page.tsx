import { Clock, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { LikeButton } from "@/components/like-button";
import { LoginLink } from "@/components/login-link";
import { PhotoGallery } from "@/components/photo-gallery";
import { PrivateBadge } from "@/components/private-badge";
import { ReviewForm } from "@/components/review-form";
import { ReviewModeration } from "@/components/review-moderation";
import { Stars } from "@/components/stars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewBeacon } from "@/components/view-beacon";
import { VoteButtons } from "@/components/vote-buttons";
import {
  getLabels,
  getListedReviews,
  getRecipe,
  getRecipeStats,
  type RecipeDetail,
} from "@/lib/data";
import {
  formatDate,
  formatMinutes,
  formatQuantity,
  formatRatingSummary,
} from "@/lib/format";
import { labelNames } from "@/lib/labels";
import {
  canBanUser,
  canModerateReview,
  canSeeContentOf,
  hasPrivateProfile,
  READ_ONLY_MESSAGE,
} from "@/lib/privileges";
import { canEditRecipe, canReviewRecipe, likeMode } from "@/lib/rules";
import { type CurrentUser, getCurrentUser } from "@/lib/session";
import { loginHref } from "@/lib/urls";

/** The recipe's author, in the shape the privacy rules take. */
function authorOf(recipe: RecipeDetail) {
  return {
    id: recipe.author.id,
    isPrivate: recipe.author.isPrivate,
    level: recipe.author.privilegeLevel,
  };
}

export async function generateMetadata(
  props: PageProps<"/recipes/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const [recipe, viewer] = await Promise.all([getRecipe(id), getCurrentUser()]);
  if (!recipe || !canSeeContentOf(viewer, authorOf(recipe))) {
    return { title: "Recipe not found" };
  }

  const description =
    recipe.description.length > 160
      ? `${recipe.description.slice(0, 157)}…`
      : recipe.description;
  const cover = recipe.images[0]?.url;
  return {
    title: recipe.title,
    description,
    openGraph: {
      type: "article",
      title: recipe.title,
      description,
      images: cover ? [{ url: cover, alt: recipe.title }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: recipe.title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function RecipePage(props: PageProps<"/recipes/[id]">) {
  const { id } = await props.params;
  const [recipe, user, allLabels] = await Promise.all([
    getRecipe(id),
    getCurrentUser(),
    getLabels(),
  ]);
  // Private authors' recipes are "not found" for everyone but them and staff
  if (!recipe || !canSeeContentOf(user, authorOf(recipe))) notFound();
  const authorPrivate = hasPrivateProfile(authorOf(recipe));

  const { rating, likes, viewerReview } = await getRecipeStats(
    recipe.id,
    user?.id ?? null,
  );
  const isAuthor = canEditRecipe(user, recipe);

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <ViewBeacon recipeId={recipe.id} />
      <MediaGallery recipe={recipe} />

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              {recipe.title}
            </h1>
            <p className="mt-1 text-muted-foreground">
              by{" "}
              <Link
                href={`/users/${recipe.author.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {recipe.author.name}
              </Link>
              {authorPrivate && <PrivateBadge className="ml-2 align-middle" />}
            </p>
          </div>
          {isAuthor && (
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/recipes/${recipe.id}/edit`}>
                  <Pencil aria-hidden /> Edit
                </Link>
              </Button>
              <DeleteRecipeButton recipeId={recipe.id} title={recipe.title} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="gap-1">
            <Clock aria-hidden className="size-3" />
            {formatMinutes(recipe.cookingMinutes)}
          </Badge>
          {recipe.servings && (
            <Badge variant="secondary" className="gap-1">
              <Users aria-hidden className="size-3" />
              Serves {recipe.servings}
            </Badge>
          )}
          {labelNames(recipe.labels, allLabels).map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2" data-testid="rating-summary">
            {rating.count > 0 && rating.average !== null && (
              <Stars value={rating.average} />
            )}
            <span className="text-sm font-medium">
              {formatRatingSummary(rating.average, rating.count)}
            </span>
          </div>
          <LikeButton
            key={`${likes.liked}:${likes.count}`}
            recipeId={recipe.id}
            title={recipe.title}
            initial={likes}
            mode={likeMode(user, recipe)}
            loginUrl={loginHref(`/recipes/${recipe.id}`)}
          />
        </div>
      </header>

      {/* US-2.3: plain text only, line breaks preserved; React escapes all user text. */}
      <p className="text-lg leading-relaxed whitespace-pre-line">
        {recipe.description}
      </p>

      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="ingredients-heading">
          <h2
            id="ingredients-heading"
            className="mb-3 border-b pb-2 text-xl font-semibold"
          >
            Ingredients
          </h2>
          <ul className="flex flex-col divide-y">
            {recipe.ingredients.map((i) => (
              <li key={i.id} className="flex gap-2 py-2">
                {(i.quantity !== null || i.unit) && (
                  <span className="shrink-0 font-medium tabular-nums">
                    {[
                      i.quantity !== null ? formatQuantity(i.quantity) : null,
                      i.unit,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                )}
                <span>{i.name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-heading">
          <h2
            id="steps-heading"
            className="mb-3 border-b pb-2 text-xl font-semibold"
          >
            Instructions
          </h2>
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((s, index) => (
              <li key={s.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {index + 1}
                </span>
                <p className="pt-0.5 leading-relaxed whitespace-pre-line">
                  {s.text}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section
        aria-labelledby="reviews-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="reviews-heading"
          className="border-b pb-2 text-xl font-semibold"
        >
          Reviews
        </h2>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <Reviews recipe={recipe} user={user} viewerReview={viewerReview} />
        </Suspense>
      </section>
    </article>
  );
}

function MediaGallery({ recipe }: { recipe: RecipeDetail }) {
  const photos = recipe.images.map((img) => ({
    id: img.id,
    url: img.url,
    alt:
      img.position === 0
        ? recipe.title
        : `${recipe.title} — photo ${img.position + 1}`,
  }));

  return (
    <div className="flex flex-col gap-3">
      {/* The video, when there is one, comes first; photos follow below it. */}
      {recipe.videoUrl && (
        // biome-ignore lint/a11y/useMediaCaption: user-uploaded cooking videos have no captions
        <video
          src={recipe.videoUrl}
          controls
          preload="metadata"
          className="aspect-video w-full rounded-xl bg-black"
          aria-label={`${recipe.title} video`}
        />
      )}
      {/* With a video on top every photo is an equal tile; otherwise the
          cover is shown large. Clicking a photo opens the full-screen viewer. */}
      <PhotoGallery
        photos={photos}
        title={recipe.title}
        layout={recipe.videoUrl ? "tiles" : "cover"}
      />
    </div>
  );
}

async function Reviews({
  recipe,
  user,
  viewerReview,
}: {
  recipe: RecipeDetail;
  user: CurrentUser | null;
  /** The viewer's own review, if any. */
  viewerReview: { rating: number; comment: string | null } | null;
}) {
  const reviews = await getListedReviews(recipe.id, user);
  const here = `/recipes/${recipe.id}`;

  return (
    <>
      {!user ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            Log in to rate and review this recipe.
          </p>
          <Suspense>
            <LoginLink size="sm">Log in to review</LoginLink>
          </Suspense>
        </div>
      ) : user.banned ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          {READ_ONLY_MESSAGE}
        </p>
      ) : canReviewRecipe(user, recipe) ? (
        <ReviewForm recipeId={recipe.id} existing={viewerReview} />
      ) : (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          This is your recipe, so you can&apos;t review it — but you can read
          what others say.
        </p>
      )}

      {reviews.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">
          No written reviews yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y" data-testid="review-list">
          {reviews.map((r) => {
            const reviewer = { id: r.authorId, level: r.authorLevel };
            return (
              <li key={r.id} className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    href={`/users/${r.authorId}`}
                    className="font-medium hover:underline"
                  >
                    {r.authorName}
                  </Link>
                  {r.authorPrivate && <PrivateBadge />}
                  <Stars value={r.rating} />
                  <span className="text-sm text-muted-foreground">
                    {formatDate(r.createdAt)}
                    {r.moderated
                      ? " · edited by a moderator"
                      : r.edited && " · edited"}
                  </span>
                  {canModerateReview(user, reviewer) && (
                    <div className="ml-auto">
                      <ReviewModeration
                        reviewId={r.id}
                        reviewerId={r.authorId}
                        reviewerName={r.authorName}
                        reviewerBanned={r.authorBanned}
                        comment={r.comment}
                        canBan={canBanUser(user, reviewer)}
                      />
                    </div>
                  )}
                </div>
                <p className="leading-relaxed whitespace-pre-line">
                  {r.comment}
                </p>
                <VoteButtons
                  key={`${r.likes}:${r.dislikes}:${r.viewerVote}`}
                  reviewId={r.id}
                  initial={{
                    likes: r.likes,
                    dislikes: r.dislikes,
                    vote: r.viewerVote,
                  }}
                  mode={
                    !user
                      ? "guest"
                      : user.banned
                        ? "readonly"
                        : user.id === r.authorId
                          ? "own"
                          : "voter"
                  }
                  loginUrl={loginHref(here)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
