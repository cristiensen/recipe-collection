"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { recipesChanged, userChanged } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import {
  canChangeDisplayName,
  canChooseProfileVisibility,
  canDeleteOwnAccount,
  LEVEL,
  READ_ONLY_MESSAGE,
} from "@/lib/privileges";
import { getCurrentUser } from "@/lib/session";
import { deleteMedia } from "@/lib/storage";
import {
  changePasswordSchema,
  displayNameSchema,
  type FieldErrors,
  toFieldErrors,
} from "@/lib/validation";

export type AccountFormState =
  | { ok: true; message: string }
  | { ok: false; errors: FieldErrors }
  | undefined;

const NOT_LOGGED_IN: AccountFormState = {
  ok: false,
  errors: { _form: "Please log in again" },
};

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function passwordMatches(userId: string, password: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return (
    !!row?.passwordHash && (await bcrypt.compare(password, row.passwordHash))
  );
}

export async function updateDisplayName(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_LOGGED_IN;
  if (!canChangeDisplayName(user)) {
    return { ok: false, errors: { _form: READ_ONLY_MESSAGE } };
  }
  const parsed = displayNameSchema.safeParse(text(formData, "name"));
  if (!parsed.success) {
    return { ok: false, errors: { name: parsed.error.issues[0].message } };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data },
  });
  // The name appears in the header, on recipes, reviews and profiles
  userChanged(user.id);
  recipesChanged();
  revalidatePath("/", "layout");
  return { ok: true, message: "Display name updated" };
}

/** Chefs and up: show or hide their profile, recipes and reviews. */
export async function updateProfileVisibility(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_LOGGED_IN;
  if (!canChooseProfileVisibility(user)) {
    return {
      ok: false,
      errors: {
        _form: user.banned
          ? READ_ONLY_MESSAGE
          : "Only chefs, moderators and admins can make their profile private.",
      },
    };
  }
  const visibility = text(formData, "visibility");
  if (visibility !== "public" && visibility !== "private") {
    return { ok: false, errors: { visibility: "Choose public or private" } };
  }
  const isPrivate = visibility === "private";
  await prisma.user.update({ where: { id: user.id }, data: { isPrivate } });
  // Affects browse, recipe pages, reviews and profiles
  recipesChanged();
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: isPrivate
      ? "Your profile is now private"
      : "Your profile is now public",
  };
}

export async function changePassword(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_LOGGED_IN;
  const parsed = changePasswordSchema.safeParse({
    current: text(formData, "current"),
    next: text(formData, "next"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success)
    return { ok: false, errors: toFieldErrors(parsed.error) };
  if (!(await passwordMatches(user.id, parsed.data.current))) {
    return { ok: false, errors: { current: "Current password is incorrect" } };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 12) },
  });
  return { ok: true, message: "Password changed" };
}

export async function deleteOwnAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_LOGGED_IN;
  const adminCount = await prisma.user.count({
    where: { privilegeLevel: { gte: LEVEL.ADMIN } },
  });
  if (!canDeleteOwnAccount(user, adminCount)) {
    return {
      ok: false,
      errors: {
        _form:
          "You're the only admin. Make someone else an admin before deleting your account.",
      },
    };
  }
  if (!(await passwordMatches(user.id, text(formData, "password")))) {
    return { ok: false, errors: { password: "Password is incorrect" } };
  }

  const recipes = await prisma.recipe.findMany({
    where: { authorId: user.id },
    select: { videoUrl: true, images: { select: { url: true } } },
  });
  // Recipes, reviews, votes and likes cascade in the database
  await prisma.user.delete({ where: { id: user.id } });
  await deleteMedia(
    recipes.flatMap((r) => [
      ...r.images.map((i) => i.url),
      ...(r.videoUrl ? [r.videoUrl] : []),
    ]),
  );
  userChanged(user.id);
  recipesChanged();
  revalidatePath("/", "layout");
  await signOut({ redirectTo: "/" });
  return undefined;
}
