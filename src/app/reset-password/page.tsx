import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { resetTokenUser } from "@/lib/password-reset";

export const metadata: Metadata = {
  title: "Reset password",
  // The URL carries a secret token: keep it out of other sites' logs
  referrer: "no-referrer",
};

export default async function ResetPasswordPage(
  props: PageProps<"/reset-password">,
) {
  const { token } = await props.searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  const valid = !!value && !!(await resetTokenUser(value));

  return (
    <div className="mx-auto w-full max-w-sm py-4 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
      {valid ? (
        <>
          <p className="mt-1 mb-6 text-muted-foreground">
            Choose a new password. You&apos;ll be logged in, and logged out
            everywhere else.
          </p>
          <ResetPasswordForm token={value} />
        </>
      ) : (
        <p className="mt-4 text-muted-foreground">
          This reset link has expired or was already used.{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Request a new link
          </Link>
        </p>
      )}
    </div>
  );
}
