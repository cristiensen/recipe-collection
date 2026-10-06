"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { loginHref } from "@/lib/urls";

/** A "Log in" button that brings the user back to the current page afterwards (US-1.3). */
export function LoginLink({
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "asChild">) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;
  const returnTo = pathname === "/login" || pathname === "/signup" ? "/" : here;

  return (
    <Button asChild {...props}>
      <Link href={loginHref(returnTo)}>{children}</Link>
    </Button>
  );
}
