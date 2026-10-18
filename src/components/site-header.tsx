import { ChefHat, CircleUser, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { logOutAction } from "@/app/actions/auth";
import { BackToTop } from "@/components/back-to-top";
import { LoginLink } from "@/components/login-link";
import { MobileMenu } from "@/components/mobile-menu";
import { RecipeSearch, RecipeSearchFallback } from "@/components/recipe-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  canCreateRecipe,
  canOpenDashboard,
  READ_ONLY_MESSAGE,
} from "@/lib/privileges";
import { getCurrentUser } from "@/lib/session";
import type { Theme } from "@/lib/theme";

export async function SiteHeader({ theme }: { theme: Theme }) {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <ChefHat className="size-5" aria-hidden />
          {/* Phones show just the icon, to leave room for the search */}
          <span className="sr-only md:not-sr-only">Recipe Collection</span>
        </Link>

        <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-4">
          <Suspense fallback={<RecipeSearchFallback />}>
            <RecipeSearch />
          </Suspense>
        </div>

        {/* Desktop (lg and up): every action as a button */}
        <div className="hidden items-center gap-2 lg:flex">
          <BackToTop />
          <ThemeToggle theme={theme} />
          {user && canOpenDashboard(user) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">
                <Shield aria-hidden />
                Manage
              </Link>
            </Button>
          )}
          {user && canCreateRecipe(user) && (
            <Button asChild size="sm">
              <Link href="/recipes/new">
                <Plus aria-hidden />
                New recipe
              </Link>
            </Button>
          )}
        </div>

        {/* The profile link stays in the header at every width */}
        {user && (
          <Button asChild variant="ghost" size="sm">
            <Link
              href={`/users/${user.id}`}
              aria-label={`Your profile (${user.name})`}
            >
              <CircleUser aria-hidden />
              <span
                className="hidden max-w-40 truncate sm:inline"
                data-testid="header-user-name"
              >
                {user.name}
              </span>
            </Link>
          </Button>
        )}

        <div className="hidden lg:block">
          {user ? (
            <form action={logOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Log out
              </Button>
            </form>
          ) : (
            <Suspense
              fallback={
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Log in</Link>
                </Button>
              }
            >
              <LoginLink variant="outline" size="sm">
                Log in
              </LoginLink>
            </Suspense>
          )}
        </div>

        {/* Tablets and phones: everything else in the ☰ menu */}
        <div className="lg:hidden">
          <MobileMenu
            theme={theme}
            loggedIn={!!user}
            canCreate={canCreateRecipe(user)}
            canManage={canOpenDashboard(user)}
          />
        </div>
      </div>
      {user?.banned && (
        <output className="block border-t bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
          {READ_ONLY_MESSAGE} You can still browse recipes.
        </output>
      )}
    </header>
  );
}
