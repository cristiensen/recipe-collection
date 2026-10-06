"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { safeCallbackUrl } from "@/lib/urls";
import {
  type FieldErrors,
  logInSchema,
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
