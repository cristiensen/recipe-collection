import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  displayNameSchema,
  type RecipeInput,
  recipeSchema,
  reviewSchema,
  signUpSchema,
  toFieldErrors,
} from "@/lib/validation";

const IMG =
  "https://abc123.public.blob.vercel-storage.com/recipes/images/pie-x1.jpg";

const valid: RecipeInput = {
  title: "  Apple pie ",
  description: "Grandma's recipe.\nBest served warm.",
  images: [IMG],
  videoUrl: null,
  ingredients: [
    { name: "Apples", quantity: 6, unit: null },
    { name: "Salt", quantity: null, unit: "" },
  ],
  steps: [{ text: "Bake." }],
  cookingMinutes: 90,
  servings: 8,
  labels: ["dessert", "vegetarian"],
};

function errorsFor(input: unknown) {
  const r = recipeSchema.safeParse(input);
  return r.success ? {} : toFieldErrors(r.error);
}

describe("recipe validation", () => {
  it("accepts a complete recipe and normalises text", () => {
    const r = recipeSchema.parse(valid);
    expect(r.title).toBe("Apple pie");
    expect(r.description).toContain("\n"); // line breaks preserved (US-2.3)
    expect(r.ingredients[1]).toEqual({
      name: "Salt",
      quantity: null,
      unit: null,
    }); // "salt to taste"
  });

  it("BR-1: requires at least one image", () => {
    expect(errorsFor({ ...valid, images: [] }).images).toBe(
      "Add at least one image",
    );
  });

  it("BR-1: allows at most 5 images", () => {
    expect(errorsFor({ ...valid, images: Array(6).fill(IMG) }).images).toMatch(
      /at most 5/,
    );
  });

  it("BR-1: rejects images that are not from our storage", () => {
    const errs = errorsFor({
      ...valid,
      images: ["https://evil.example.com/a.jpg"],
    });
    expect(errs["images.0"]).toBe("Invalid image upload");
  });

  it("rejects a video URL with an image extension", () => {
    expect(errorsFor({ ...valid, videoUrl: IMG }).videoUrl).toBe(
      "Invalid video upload",
    );
  });

  it.each([
    0,
    -5,
    1.5,
    Number.NaN,
  ])("BR-2: rejects cooking time %s", (cookingMinutes) => {
    expect(
      errorsFor({ ...valid, cookingMinutes }).cookingMinutes,
    ).toBeDefined();
  });

  it("BR-3: requires at least one ingredient and one step", () => {
    const errs = errorsFor({ ...valid, ingredients: [], steps: [] });
    expect(errs.ingredients).toBe("Add at least one ingredient");
    expect(errs.steps).toBe("Add at least one step");
  });

  it("BR-3: blank ingredient names and steps don't count", () => {
    const errs = errorsFor({
      ...valid,
      ingredients: [{ name: "  ", quantity: 1, unit: null }],
      steps: [{ text: "   " }],
    });
    expect(errs["ingredients.0.name"]).toBe("Ingredient name is required");
    expect(errs["steps.0.text"]).toBe("Step can't be empty");
  });

  it("requires title and description", () => {
    const errs = errorsFor({ ...valid, title: " ", description: "" });
    expect(errs.title).toBe("Title is required");
    expect(errs.description).toBe("Description is required");
  });

  // Whether labels exist is checked by the Server Actions (labels are data)
  it("rejects duplicate labels", () => {
    expect(errorsFor({ ...valid, labels: ["vegan", "vegan"] }).labels).toBe(
      "Duplicate label",
    );
  });
});

describe("review validation", () => {
  it.each([1, 3, 5])("BR-6: accepts rating %s", (rating) => {
    expect(reviewSchema.safeParse({ rating, comment: null }).success).toBe(
      true,
    );
  });

  it.each([0, 6, 2.5, Number.NaN])("BR-6: rejects rating %s", (rating) => {
    expect(reviewSchema.safeParse({ rating, comment: null }).success).toBe(
      false,
    );
  });

  it("trims comments; whitespace-only becomes no comment", () => {
    expect(
      reviewSchema.parse({ rating: 4, comment: "  Lovely!  " }).comment,
    ).toBe("Lovely!");
    expect(
      reviewSchema.parse({ rating: 4, comment: "   \n " }).comment,
    ).toBeNull();
    expect(reviewSchema.parse({ rating: 4, comment: "" }).comment).toBeNull();
  });

  it("limits comments to 2,000 characters after trimming", () => {
    expect(
      reviewSchema.safeParse({ rating: 4, comment: ` ${"a".repeat(2000)} ` })
        .success,
    ).toBe(true);
    expect(
      reviewSchema.safeParse({ rating: 4, comment: "a".repeat(2001) }).success,
    ).toBe(false);
  });
});

describe("sign-up validation", () => {
  it("normalises email", () => {
    const r = signUpSchema.parse({
      name: "Ana",
      email: " Ana@Example.COM ",
      password: "longenough",
    });
    expect(r.email).toBe("ana@example.com");
  });

  it("requires a display name and an 8+ character password", () => {
    const r = signUpSchema.safeParse({
      name: "",
      email: "a@b.co",
      password: "short",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = toFieldErrors(r.error);
      expect(errs.name).toBeDefined();
      expect(errs.password).toBeDefined();
    }
  });
});

describe("change password validation", () => {
  const valid = {
    current: "old-password",
    next: "new-password",
    confirm: "new-password",
  };
  it("accepts a matching new password", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });
  it("requires the current password", () => {
    const r = changePasswordSchema.safeParse({ ...valid, current: "" });
    expect(r.success).toBe(false);
  });
  it("applies the sign-up length rules", () => {
    const r = changePasswordSchema.safeParse({
      ...valid,
      next: "short",
      confirm: "short",
    });
    expect(r.success).toBe(false);
  });
  it("requires the confirmation to match", () => {
    const r = changePasswordSchema.safeParse({
      ...valid,
      confirm: "different-one",
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(toFieldErrors(r.error).confirm).toBe("Passwords don't match");
  });
  it("trims display names and rejects empty ones", () => {
    expect(displayNameSchema.parse("  Ana  ")).toBe("Ana");
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
  });
});
