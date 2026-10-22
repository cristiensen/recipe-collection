"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  type AuthFormState,
  logInAction,
  signUpAction,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({
  mode,
  callbackUrl,
}: {
  mode: "login" | "signup";
  callbackUrl: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? logInAction : signUpAction,
    undefined,
  );
  const errors = state?.errors ?? {};
  const otherHref = `${mode === "login" ? "/signup" : "/login"}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {errors._form && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errors._form}
        </p>
      )}

      {mode === "signup" && (
        <Field
          id="name"
          label="Display name"
          error={errors.name}
          hint="Shown on your recipes and reviews."
        >
          <Input
            id="name"
            name="name"
            autoComplete="nickname"
            defaultValue={state?.values.name}
            aria-invalid={!!errors.name}
            aria-describedby="name-hint name-error"
            required
          />
        </Field>
      )}

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

      <Field
        id="password"
        label="Password"
        error={errors.password}
        hint={mode === "signup" ? "At least 8 characters." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          aria-invalid={!!errors.password}
          aria-describedby="password-hint password-error"
          required
        />
      </Field>
      {mode === "login" && (
        <Link
          href="/forgot-password"
          className="-mt-2 self-end text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Forgot password?
        </Link>
      )}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending
          ? mode === "login"
            ? "Logging in…"
            : "Creating account…"
          : mode === "login"
            ? "Log in"
            : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link
          href={otherHref}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </Link>
      </p>
    </form>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
