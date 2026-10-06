import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { deleteUsers, setLevel } from "./db";

/**
 * The PRD's end-to-end journey: sign-up → create recipe → review → vote.
 * Two users: the author (promoted to chef) and a reviewer. The author also
 * votes, since they can vote on someone else's review of their recipe.
 */

const run = Date.now();
const author = {
  name: `Author ${run}`,
  email: `author-${run}@e2e.test`,
  password: "password-123",
};
const reviewer = {
  name: `Reviewer ${run}`,
  email: `reviewer-${run}@e2e.test`,
  password: "password-123",
};
const title = `E2E Lemon Tart ${run}`;

// Remove this run's users (recipes, reviews and votes cascade) even if the test fails.
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

async function signUp(page: Page, user: typeof author, from = "/") {
  await page.goto(from);
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Display name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByTestId("header-user-name")).toHaveText(user.name);
}

async function logOut(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(
    page.getByRole("link", { name: "Log in", exact: true }),
  ).toBeVisible();
}

test("sign-up → create recipe → review → vote", async ({ page }) => {
  // 1. Author signs up and publishes a recipe
  await signUp(page, author);
  // New accounts are level 1; publishing needs chef (an admin would grant it)
  await expect(page.getByRole("link", { name: "New recipe" })).toHaveCount(0);
  await setLevel(author.email, 2);
  await page.reload();
  await page.getByRole("link", { name: "New recipe" }).click();
  await expect(
    page.getByRole("heading", { name: "Share a recipe" }),
  ).toBeVisible();

  // Mandatory fields are marked; the "*" isn't part of their accessible names
  const requiredFields = [
    ["textbox", "Title"],
    ["textbox", "Description"],
    ["spinbutton", "Total cooking time (minutes)"],
    ["textbox", "Ingredient 1 name"],
    ["textbox", "Step 1"],
  ] as const;
  for (const [role, name] of requiredFields) {
    await expect(page.getByRole(role, { name, exact: true })).toHaveAttribute(
      "required",
      "",
    );
  }
  await expect(
    page.getByRole("spinbutton", { name: "Servings (optional)", exact: true }),
  ).not.toHaveAttribute("required");
  await expect(
    page.getByRole("heading", { name: "Ingredients (required)" }),
  ).toBeVisible();

  // Submitting empty shows inline errors and keeps the form
  await page.getByRole("button", { name: "Publish recipe" }).click();
  await expect(page.getByText("Add at least one image")).toBeVisible();
  await expect(page.getByText("Title is required")).toBeVisible();

  await page
    .getByTestId("image-input")
    .setInputFiles(path.join(__dirname, "fixtures/dish.png"));
  await expect(page.getByText("Cover", { exact: true })).toBeVisible();
  await page.getByLabel("Title").fill(title);
  await page
    .getByLabel("Description")
    .fill("Bright and buttery.\nServe chilled.");
  await page.getByLabel("Total cooking time (minutes)").fill("75");
  await page.getByText("Dessert", { exact: true }).click();
  await page.getByLabel("Ingredient 1 quantity").fill("3");
  await page.getByLabel("Ingredient 1 name").fill("Lemons");
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Ingredient 2 name").fill("Salt to taste");
  await page.getByLabel("Step 1", { exact: true }).fill("Make the pastry.");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Step 2", { exact: true }).fill("Fill and bake.");
  await expect(
    page.getByRole("button", { name: "Publish recipe" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Publish recipe" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  await expect(page.getByText("1 h 15 min")).toBeVisible();
  await expect(page.getByTestId("rating-summary")).toHaveText("No ratings yet");
  await expect(page.getByText("This is your recipe")).toBeVisible(); // no self-review form
  const recipeUrl = new URL(page.url()).pathname;
  await logOut(page);

  // 2. A guest is sent to log in, signs up, and comes back to the recipe
  await page.goto(recipeUrl);
  await signUp(page, reviewer, recipeUrl);
  await expect(page).toHaveURL(new RegExp(`${recipeUrl}$`));

  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: "4 stars" }) })
    .click();
  await expect(page.getByRole("radio", { name: "4 stars" })).toBeChecked();
  await page.getByLabel("Comment (optional)").fill("  Tangy and delicious!  ");
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByTestId("rating-summary")).toHaveText(
    /4\.0 from 1 rating/,
  );
  const review = page.getByTestId("review-list").getByRole("listitem").first();
  await expect(review).toContainText("Tangy and delicious!");
  // The reviewer can't vote on their own review
  await expect(review.getByRole("button", { name: /^Like/ })).toBeDisabled();
  // ...and the form now edits the existing review (one review per recipe)
  await expect(
    page.getByRole("button", { name: "Update review" }),
  ).toBeVisible();
  await logOut(page);

  // 3. The author likes the review, then switches to dislike
  await page.goto(`/login?callbackUrl=${encodeURIComponent(recipeUrl)}`);
  await page.getByLabel("Email").fill(author.email);
  await page.getByLabel("Password").fill(author.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp(`${recipeUrl}$`));

  const like = review.getByRole("button", { name: /^Like/ });
  const dislike = review.getByRole("button", { name: /^Dislike/ });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAccessibleName("Like (1)");
  await dislike.click();
  await expect(dislike).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAccessibleName("Like (0)");
  await expect(dislike).toHaveAccessibleName("Dislike (1)");

  // Votes persist across reloads (wait for the server to confirm first)
  await expect(review.locator("[aria-busy=false]")).toBeVisible();
  await page.reload();
  await expect(
    review.getByRole("button", { name: /^Dislike/ }),
  ).toHaveAccessibleName("Dislike (1)");

  // 4. Clean up: the author deletes the recipe (cascades reviews and votes)
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete recipe" }).click();
  await expect(page).toHaveURL(/\/$/);
  const res = await page.goto(recipeUrl);
  expect(res?.status()).toBe(404);
});
