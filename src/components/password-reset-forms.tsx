"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  type ForgotPasswordState,
  type ResetPasswordState,
  requestPasswordReset,
  resetPasswordAction,
} from "@/app/actions/auth";
import { Field } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<
    ForgotPasswordState,
    FormData
  >(requestPasswordReset, undefined);

  if (state?.sent) {
    return (
      <div className="flex flex-col gap-4">
        <output className="block rounded-md bg-muted p-3 text-sm">
          If an account exists for <strong>{state.email}</strong>, we&apos;ve
          sent it a link to reset the password. The link expires in 1 hour.
        </output>
        <p className="text-sm text-muted-foreground">
          Nothing arrived? Check your spam folder, or wait a minute and{" "}
          {/* A full page load, to start the form over */}
          <a
            href="/forgot-password"
            className="font-medium text-foreground underline underline-offset-4"
          >
            try again
          </a>
          .
        </p>
      </div>
    );
  }

  const errors = state?.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field id="email" label="Email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state?.values.email}
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
          required
        />
      </Field>
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    undefined,
  );
  const errors = state?.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {(errors._form || errors.token) && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errors._form ?? errors.token}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </p>
      )}
      <Field
        id="password"
        label="New password"
        error={errors.password}
        hint="At least 8 characters."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby="password-hint password-error"
          required
        />
      </Field>
      <Field id="confirm" label="Confirm new password" error={errors.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          aria-describedby="confirm-error"
          required
        />
      </Field>
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
