import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountSettings } from "@/components/account-settings";
import { PrivateBadge } from "@/components/private-badge";
import { RecipeFeed } from "@/components/recipe-feed";
import { Badge } from "@/components/ui/badge";
import { getLikedRecipes, getUserProfile, getUserRecipes } from "@/lib/data";
import {
  canChangeDisplayName,
  canChooseProfileVisibility,
  canSeeContentOf,
  hasPrivateProfile,
  levelName,
} from "@/lib/privileges";
import { clampShown, MAX_SHOWN, PAGE_SIZE } from "@/lib/rules";
import { getCurrentUser } from "@/lib/session";
import { loginHref } from "@/lib/urls";
import { cn } from "@/lib/utils";

type Tab = "recipes" | "liked" | "settings";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** `/users/<id>`, `?tab=liked`, `?shown=24`… (defaults left out of the URL). */
function profileHref(userId: string, tab: Tab, shown = PAGE_SIZE) {
  const params = new URLSearchParams();
  if (tab !== "recipes") params.set("tab", tab);
  if (shown > PAGE_SIZE) params.set("shown", String(shown));
  const qs = params.toString();
  return `/users/${userId}${qs ? `?${qs}` : ""}`;
}

const monthYear = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

export async function generateMetadata(
  props: PageProps<"/users/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const [profile, viewer] = await Promise.all([
    getUserProfile(id),
    getCurrentUser(),
  ]);
  return {
    title:
      profile && canSeeContentOf(viewer, profile)
        ? profile.name
        : "User not found",
  };
}

export default async function ProfilePage(props: PageProps<"/users/[id]">) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const [profile, viewer] = await Promise.all([
    getUserProfile(id),
    getCurrentUser(),
  ]);
  // Private profiles are "not found" for everyone but the owner and staff
  if (!profile || !canSeeContentOf(viewer, profile)) notFound();
  const isPrivate = hasPrivateProfile(profile);

  const isOwner = viewer?.id === profile.id;
  const requested = first(params.tab);
  // Settings only exist on your own profile
  const tab: Tab =
    requested === "liked" || (requested === "settings" && isOwner)
      ? requested
      : "recipes";
  const shown = clampShown(first(params.shown));

  const tabs: { key: Tab; label: string }[] = [
    { key: "recipes", label: "Recipes" },
    { key: "liked", label: "Liked" },
    ...(isOwner ? [{ key: "settings" as const, label: "Settings" }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <div
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
        >
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {profile.name}
            </h1>
            <Badge variant="secondary">{levelName(profile.level)}</Badge>
            {isOwner && <Badge variant="outline">You</Badge>}
            {isPrivate && <PrivateBadge />}
          </div>
          <p className="text-sm text-muted-foreground">
            Member since {monthYear.format(profile.memberSince)}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Recipes" value={profile.recipeCount} />
        <Stat label="Reviews" value={profile.reviewCount} />
        <Stat
          label="Likes received"
          value={profile.likesReceived}
          icon={
            <Heart aria-hidden className="size-4 fill-red-500 text-red-500" />
          }
        />
      </dl>

      <nav aria-label="Profile sections" className="border-b">
        <ul className="-mb-px flex gap-1">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={profileHref(profile.id, t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors hover:text-foreground",
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "settings" && viewer ? (
        <AccountSettings
          name={profile.name}
          canRename={canChangeDisplayName(viewer)}
          isPrivate={profile.isPrivate}
          canChooseVisibility={canChooseProfileVisibility(viewer)}
        />
      ) : (
        <ProfileRecipes
          userId={profile.id}
          tab={tab === "liked" ? "liked" : "recipes"}
          shown={shown}
          viewer={viewer}
          isOwner={isOwner}
          name={profile.name}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
        {icon}
        {value}
      </dd>
    </div>
  );
}

async function ProfileRecipes({
  userId,
  tab,
  shown,
  viewer,
  isOwner,
  name,
}: {
  userId: string;
  tab: "recipes" | "liked";
  shown: number;
  viewer: Awaited<ReturnType<typeof getCurrentUser>>;
  isOwner: boolean;
  name: string;
}) {
  const load = tab === "liked" ? getLikedRecipes : getUserRecipes;
  const { recipes, total } = await load(userId, shown, viewer);
  const hasMore = recipes.length < total && shown < MAX_SHOWN;
  const here = profileHref(userId, tab, shown);

  if (recipes.length === 0) {
    const message =
      tab === "liked"
        ? isOwner
          ? "You haven't liked any recipes yet. Tap the heart on a recipe to save it here."
          : `${name} hasn't liked any recipes yet.`
        : isOwner
          ? "You haven't published any recipes yet."
          : `${name} hasn't published any recipes yet.`;
    return (
      <p className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
        {message}
      </p>
    );
  }

  return (
    <RecipeFeed
      key={`${userId}-${tab}`}
      recipes={recipes}
      moreHref={hasMore ? profileHref(userId, tab, shown + PAGE_SIZE) : null}
      capped={recipes.length < total && !hasMore}
      viewer={
        viewer
          ? { id: viewer.id, level: viewer.level, banned: viewer.banned }
          : null
      }
      loginUrl={loginHref(here)}
    />
  );
}
