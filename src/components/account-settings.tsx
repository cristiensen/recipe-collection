"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type AccountFormState,
  changePassword,
  deleteOwnAccount,
  updateDisplayName,
  updateProfileVisibility,
} from "@/app/actions/account";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Owner-only settings on their profile: display name, visibility, labels, password, delete account. */
export function AccountSettings({
  name,
  canRename,
  isPrivate,
  canChooseVisibility,
  labels,
}: {
  name: string;
  /** False for banned (read-only) accounts. */
  canRename: boolean;
  /** The saved privacy setting. */
  isPrivate: boolean;
  /** Chefs and up (not banned) can change it. */
  canChooseVisibility: boolean;
  /** The Labels section, for chefs and up. */
  labels?: React.ReactNode;
}) {
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <DisplayNameForm name={name} canRename={canRename} />
      {(canChooseVisibility || isPrivate) && (
        <VisibilityForm isPrivate={isPrivate} canChoose={canChooseVisibility} />
      )}
      {labels}
      <PasswordForm />
      <DeleteAccount />
    </div>
  );
}

function useToastOnSuccess(state: AccountFormState) {
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);
}

function Section({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-5",
        danger && "border-destructive/50",
      )}
    >
      <div>
        <h2 className={cn("font-semibold", danger && "text-destructive")}>
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  error,
  ...input
}: { id: string; label: string; error?: string } & React.ComponentProps<
  typeof Input
>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function FormError({ state }: { state: AccountFormState }) {
  if (!state || state.ok || !state.errors._form) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {state.errors._form}
    </p>
  );
}

const errorsOf = (state: AccountFormState) =>
  state && !state.ok ? state.errors : {};

function DisplayNameForm({
  name,
  canRename,
}: {
  name: string;
  canRename: boolean;
}) {
  const [state, action, pending] = useActionState(updateDisplayName, undefined);
  useToastOnSuccess(state);
  return (
    <Section
      title="Display name"
      description="Shown on your recipes, reviews and profile."
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <Field
          id="settings-name"
          name="name"
          label="Display name"
          defaultValue={name}
          autoComplete="nickname"
          maxLength={50}
          disabled={!canRename}
          error={errorsOf(state).name}
        />
        {!canRename && (
          <p className="text-sm text-muted-foreground">
            Your account is read-only, so your name can&apos;t be changed.
          </p>
        )}
        <Button
          type="submit"
          className="w-fit"
          disabled={pending || !canRename}
        >
          {pending ? "Saving…" : "Save name"}
        </Button>
      </form>
    </Section>
  );
}

function VisibilityForm({
  isPrivate,
  canChoose,
}: {
  isPrivate: boolean;
  canChoose: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateProfileVisibility,
    undefined,
  );
  useToastOnSuccess(state);
  const options = [
    {
      value: "public",
      label: "Public",
      hint: "Anyone can see your profile, recipes and reviews.",
    },
    {
      value: "private",
      label: "Private",
      hint: "Only you, moderators and admins can see your profile, recipes and reviews. Your star ratings still count toward recipe averages.",
    },
  ];
  return (
    <Section
      title="Profile visibility"
      description="Choose who can see what you share."
    >
      <form action={action} className="flex flex-col gap-4">
        <FormError state={state} />
        <fieldset disabled={!canChoose} className="flex flex-col gap-2">
          <legend className="sr-only">Profile visibility</legend>
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5 has-disabled:cursor-not-allowed has-disabled:opacity-60"
            >
              <input
                type="radio"
                name="visibility"
                value={o.value}
                defaultChecked={(o.value === "private") === isPrivate}
                className="mt-1 accent-primary"
              />
              <span className="flex flex-col">
                <span className="font-medium">{o.label}</span>
                <span className="text-sm text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {!canChoose && (
          <p className="text-sm text-muted-foreground">
            Your account is read-only, so this can&apos;t be changed.
          </p>
        )}
        <Button
          type="submit"
          className="w-fit"
          disabled={pending || !canChoose}
        >
          {pending ? "Saving…" : "Save visibility"}
        </Button>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(changePassword, undefined);
  useToastOnSuccess(state);
  // Don't leave passwords sitting in the fields after a successful change
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  const errors = errorsOf(state);
  return (
    <Section
      title="Password"
      description="Use at least 8 characters. You'll need your current password."
    >
      <form
        ref={formRef}
        action={action}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormError state={state} />
        <Field
          id="settings-current"
          name="current"
          type="password"
          label="Current password"
          autoComplete="current-password"
          error={errors.current}
        />
        <Field
          id="settings-next"
          name="next"
          type="password"
          label="New password"
          autoComplete="new-password"
          error={errors.next}
        />
        <Field
          id="settings-confirm"
          name="confirm"
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirm}
        />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
      </form>
    </Section>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteOwnAccount, undefined);
  const errors = errorsOf(state);
  return (
    <Section
      title="Delete account"
      description="Permanently deletes your account with all your recipes (including photos and videos), reviews, votes and likes. This can't be undone."
      danger
    >
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-fit">
            Delete my account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form action={action} className="flex flex-col gap-4" noValidate>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything you&apos;ve shared will be removed for good. Enter
                your password to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <FormError state={state} />
            <Field
              id="delete-password"
              name="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              error={errors.password}
            />
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Deleting…" : "Delete account"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
