"use client";

import { Moon, Sun } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { setThemeAction } from "@/app/actions/theme";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/theme";

/** Switches the theme instantly and saves it (shared by button and menu). */
export function useThemeSwitch(theme: Theme) {
  const [current, setOptimistic] = useOptimistic(theme);
  const [, startTransition] = useTransition();
  const dark = current === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    startTransition(async () => {
      setOptimistic(next);
      // Switch instantly; the action saves the cookie and refreshes the page.
      document.documentElement.classList.toggle("dark", next === "dark");
      await setThemeAction(next);
    });
  }

  return { dark, toggle };
}

/** Header switch for the dark blue theme (on by default). */
export function ThemeToggle({ theme }: { theme: Theme }) {
  const { dark, toggle } = useThemeSwitch(theme);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      role="switch"
      aria-checked={dark}
      aria-label="Dark blue theme"
      title={dark ? "Switch to light theme" : "Switch to dark blue theme"}
      onClick={toggle}
    >
      {dark ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </Button>
  );
}
