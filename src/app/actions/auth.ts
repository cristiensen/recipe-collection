"use server";

import bcrypt from "bcryptjs";
import { after } from "next/server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { userChanged } from "@/lib/cache";
import { sendEmail } from "@/lib/email";
import { createResetToken, resetPassword } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { safeCallbackUrl, siteUrl } from "@/lib/urls";
import {
  type FieldErrors,
  forgotPasswordSchema,
  logInSchema,
  resetPasswordSchema,
  signUpSchema,
  toFieldErrors,
} from "@/lib/validation";

export type AuthFormState =
  | { errors: FieldErrors; values: { name?: string; email?: string } }
  | undefined;

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  };
  const values = { name: raw.name, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };

  const { name, email, password } = parsed.data;
  try {
    await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        errors: { email: "An account with this email already exists" },
        values,
      };
    }
    throw e;
  }

  // US-1.1: logged in and returned to where they came from. signIn redirects
  // by throwing, so it must stay outside any try/catch.
  await signIn("credentials", {
    email,
    password,
    redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
  });
}

export async function logInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: field(formData, "email"),
    password: field(formData, "password"),
  };
  const values = { email: raw.email };
  const parsed = logInSchema.safeParse(raw);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { errors: { _form: "Invalid email or password" }, values };
    }
    throw e; // includes the redirect thrown on success
  }
}

export async function logOutAction() {
  await signOut({ redirectTo: "/" });
}

export type ForgotPasswordState =
  | { sent: true; email: string }
  | { sent: false; errors: FieldErrors; values: { email: string } }
  | undefined;

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const raw = { email: field(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { sent: false, errors: toFieldErrors(parsed.error), values: raw };
  }
  const { email } = parsed.data;

  // Look up the account and send the email after responding, so the answer
  // and its timing are the same whether or not the email is registered
  after(async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true },
      });
      if (!user) return;
      const token = await createResetToken(user.id);
      if (!token) return; // one was sent less than a minute ago
      const link = `${siteUrl}/reset-password?token=${token}`;
      await sendEmail({
        to: email,
        subject: "Reset your Recipe Collection password",
        text: [
          `Hi ${user.name},`,
          `Open this link to choose a new password:\n${link}`,
          "It expires in 1 hour. If you didn't ask to reset your password, ignore this email.",
        ].join("\n\n"),
        html: `<p>Hi ${escapeHtml(user.name)},</p><p><a href="${link}">Choose a new password</a></p><p>The link expires in 1 hour. If you didn't ask to reset your password, ignore this email.</p>`,
      });
    } catch (e) {
      console.error("Password reset email failed", e);
    }
  });
  return { sent: true, email };
}

export type ResetPasswordState = { errors: FieldErrors } | undefined;

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: field(formData, "token"),
    password: field(formData, "password"),
    confirm: field(formData, "confirm"),
  });
  if (!parsed.success) return { errors: toFieldErrors(parsed.error) };

  const user = await resetPassword(parsed.data.token, parsed.data.password);
  if (!user) {
    return {
      errors: { _form: "This reset link has expired or was already used." },
    };
  }
  // Other sessions on this account are now signed out (see getCurrentUser)
  userChanged(user.id);
  await signIn("credentials", {
    email: user.email,
    password: parsed.data.password,
    redirectTo: "/",
  });
}

function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}
