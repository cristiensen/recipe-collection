import { z } from "zod";
import { MAX_LABEL_NAME_LENGTH, slugify } from "@/lib/labels";
import { isAllowedMediaUrl, MAX_IMAGES } from "@/lib/media";

/**
 * Zod schemas shared by the forms (instant inline errors) and the Server
 * Actions (authoritative checks). Never trust the client-side pass alone.
 */

const optionalText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => (v ? v : null));

// ─────────────────────────────── Accounts ───────────────────────────────

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name must be 50 characters or fewer"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  // bcrypt only uses the first 72 bytes
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
});

export const logInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: signUpSchema.shape.email,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is incomplete"),
    password: signUpSchema.shape.password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

// ──────────────────────────────── Recipes ────────────────────────────────

export const ingredientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ingredient name is required")
    .max(200, "Ingredient name is too long"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .positive("Quantity must be greater than 0")
    .max(100_000, "Quantity is too large")
    .nullable(),
  unit: optionalText(30, "Unit must be 30 characters or fewer"),
});

export const stepSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Step can't be empty")
    .max(5000, "Step is too long"),
});

export const recipeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(5000, "Description must be 5,000 characters or fewer"),
  // BR-1
  images: z
    .array(
      z
        .string()
        .refine((u) => isAllowedMediaUrl(u, "image"), "Invalid image upload"),
    )
    .min(1, "Add at least one image")
    .max(MAX_IMAGES, `Add at most ${MAX_IMAGES} images`),
  videoUrl: z
    .string()
    .refine((u) => isAllowedMediaUrl(u, "video"), "Invalid video upload")
    .nullable(),
  // BR-3
  ingredients: z
    .array(ingredientSchema)
    .min(1, "Add at least one ingredient")
    .max(100, "Too many ingredients"),
  steps: z
    .array(stepSchema)
    .min(1, "Add at least one step")
    .max(100, "Too many steps"),
  // BR-2
  cookingMinutes: z
    .number({ error: "Cooking time is required" })
    .int("Cooking time must be whole minutes")
    .positive("Cooking time must be greater than 0")
    .max(10_000, "Cooking time is too long"),
  servings: z
    .number({ error: "Servings must be a number" })
    .int("Servings must be a whole number")
    .positive("Servings must be greater than 0")
    .max(100, "Servings must be 100 or fewer")
    .nullable(),
  // Label slugs; the Server Actions check they exist
  labels: z
    .array(z.string().max(MAX_LABEL_NAME_LENGTH))
    .refine((l) => new Set(l).size === l.length, "Duplicate label"),
});

export type RecipeInput = z.input<typeof recipeSchema>;
export type RecipeData = z.output<typeof recipeSchema>;

// ──────────────────────────────── Reviews ────────────────────────────────

export const MAX_COMMENT_LENGTH = 2000;

export const reviewSchema = z.object({
  // BR-6
  rating: z
    .number({ error: "Choose a rating" })
    .int("Rating must be whole stars")
    .min(1, "Rating must be 1 to 5 stars")
    .max(5, "Rating must be 1 to 5 stars"),
  // US-4.1: trimmed; empty or whitespace-only becomes "no comment" (null)
  comment: optionalText(
    MAX_COMMENT_LENGTH,
    `Comment must be ${MAX_COMMENT_LENGTH.toLocaleString("en")} characters or fewer`,
  ),
});

export type ReviewData = z.output<typeof reviewSchema>;

// ──────────────────────────────── Labels ────────────────────────────────

/** A new label's name (single-spaced), with the slug it gets. */
export const labelNameSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Enter a label name")
      .max(
        MAX_LABEL_NAME_LENGTH,
        `Label must be ${MAX_LABEL_NAME_LENGTH} characters or fewer`,
      )
      .refine((v) => slugify(v) !== "", "Use at least one letter or number"),
  )
  .transform((name) => ({ name, slug: slugify(name) }));

// ──────────────────────────────── Helpers ────────────────────────────────

export type FieldErrors = Record<string, string>;

/** Flatten issues to `{ "ingredients.0.name": "..." }`, keeping the first message per path. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    errors[key] ??= issue.message;
  }
  return errors;
}

// ─────────────────────────────── Account settings ───────────────────────────────

/** Same rules as at sign-up. */
export const displayNameSchema = signUpSchema.shape.name;

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: signUpSchema.shape.password,
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });
