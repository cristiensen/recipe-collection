"use client";

import {
  ArrowUp,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  Shield,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { logOutAction } from "@/app/actions/auth";
import { useBackToTop } from "@/components/back-to-top";
import { useThemeSwitch } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Theme } from "@/lib/theme";
import { loginHref } from "@/lib/urls";

/** Where to come back to after logging in (not the login/sign-up pages). */
function returnPath() {
  const { pathname, search } = window.location;
  return pathname === "/login" || pathname === "/signup"
    ? "/"
    : pathname + search;
}

/**
 * The header's ☰ menu on tablets and phones (below `lg`): every header action
 * except the profile link, which stays visible in the header.
 */
export function MobileMenu({
  theme,
  loggedIn,
  canCreate,
  canManage,
}: {
  theme: Theme;
  loggedIn: boolean;
  canCreate: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const { dark, toggle } = useThemeSwitch(theme);
  const backToTop = useBackToTop();
  const [, startTransition] = useTransition();
  // "Back to top" moves focus to the page heading; the menu must not then
  // move it back to the ☰ button when it closes.
  const skipFocusReturn = useRef(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Menu">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48"
        onCloseAutoFocus={(e) => {
          if (skipFocusReturn.current) {
            e.preventDefault();
            skipFocusReturn.current = false;
            backToTop.scrollToTop();
          }
        }}
      >
        {canCreate && (
          <DropdownMenuItem onSelect={() => router.push("/recipes/new")}>
            <Plus /> New recipe
          </DropdownMenuItem>
        )}
        {canManage && (
          <DropdownMenuItem onSelect={() => router.push("/admin")}>
            <Shield /> Manage
          </DropdownMenuItem>
        )}
        {backToTop.enabled && backToTop.visible && (
          <DropdownMenuItem
            onSelect={() => {
              skipFocusReturn.current = true;
            }}
          >
            <ArrowUp /> Back to top
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          // Keep the menu open so the change is visible
          onSelect={(e) => {
            e.preventDefault();
            toggle();
          }}
        >
          {dark ? <Sun /> : <Moon />}
          {dark ? "Switch to light theme" : "Switch to dark blue theme"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {loggedIn ? (
          <DropdownMenuItem
            onSelect={() => startTransition(() => logOutAction())}
          >
            <LogOut /> Log out
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={() =>
              // Come back to this page after logging in (US-1.3)
              router.push(loginHref(returnPath()))
            }
          >
            <LogIn /> Log in
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
