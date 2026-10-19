"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { labelsChanged, recipesChanged } from "@/lib/cache";
import { type LabelOption, MAX_TOTAL_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import {
  canCreateLabel,
  canDeleteLabel,
  LABEL_DELETE_WINDOW_MS,
  READ_ONLY_MESSAGE,
} from "@/lib/privileges";
import { getCurrentUser } from "@/lib/session";
import { type FieldErrors, labelNameSchema } from "@/lib/validation";

export type LabelFormState =
  | { ok: true; message: string; label: LabelOption }
  | { ok: false; errors: FieldErrors }
  | undefined;

const WINDOW_MINUTES = LABEL_DELETE_WINDOW_MS / 60_000;

/** Chefs and up: add a label everyone can use on recipes and in filters. */
export async function createLabel(
  _prev: LabelFormState,
  formData: FormData,
): Promise<LabelFormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: { _form: "Please log in again" } };
  if (!canCreateLabel(user)) {
    return {
      ok: false,
      errors: {
        _form: user.banned
          ? READ_ONLY_MESSAGE
          : "Only chefs, moderators and admins can create labels.",
      },
    };
  }
  const name = formData.get("name");
  const parsed = labelNameSchema.safeParse(
    typeof name === "string" ? name : "",
  );
  if (!parsed.success) {
    return { ok: false, errors: { name: parsed.error.issues[0].message } };
  }
  const label = parsed.data;
  const exists = (existing: string) => ({
    ok: false as const,
    errors: { name: `There's already a label called “${existing}”` },
  });

  const existing = await prisma.label.findUnique({
    where: { slug: label.slug },
    select: { name: true },
  });
  if (existing) return exists(existing.name);
  try {
    const created = await prisma.$transaction(async (tx) => {
      // One label creation at a time, so concurrent ones can't pass the limit
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('create-label'))`;
      if ((await tx.label.count()) >= MAX_TOTAL_LABELS) return false;
      await tx.label.create({ data: { ...label, createdById: user.id } });
      return true;
    });
    if (!created) {
      return {
        ok: false,
        errors: {
          _form: `There can be at most ${MAX_TOTAL_LABELS} labels. Ask an admin to delete unused ones.`,
        },
      };
    }
  } catch (e) {
    // Someone created the same label meanwhile
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return exists(label.name);
    }
    throw e;
  }

  labelsChanged();
  // Filters, the recipe form and Settings list the labels
  revalidatePath("/", "layout");
  return { ok: true, message: `Label “${label.name}” created`, label };
}

/**
 * Creators can delete their label within the first minutes; admins can
 * delete any label. It's removed from every recipe that had it.
 */
export async function deleteLabel(
  slug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in again" };

  const label = await prisma.label.findUnique({
    where: { slug },
    select: { createdById: true, createdAt: true },
  });
  if (!label) return { ok: false, error: "This label no longer exists" };
  if (!canDeleteLabel(user, label, new Date())) {
    return {
      ok: false,
      error: user.banned
        ? READ_ONLY_MESSAGE
        : label.createdById === user.id
          ? `Labels can only be deleted within ${WINDOW_MINUTES} minutes of creating them. Ask an admin to delete it.`
          : "Only admins can delete labels created by someone else.",
    };
  }

  // Raw SQL so the recipes' `updatedAt` (their last edit) stays as it was
  await prisma.$transaction([
    prisma.label.delete({ where: { slug } }),
    prisma.$executeRaw`UPDATE "Recipe" SET labels = array_remove(labels, ${slug})
      WHERE labels @> ARRAY[${slug}]::text[]`,
  ]);

  labelsChanged();
  recipesChanged();
  revalidatePath("/", "layout");
  return { ok: true };
}
