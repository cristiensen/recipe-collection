import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe, insertReview } from "./db";

const run = Date.now();
const email = (who: string) => `rating${who}-${run}@e2e.test`;
const titles = {
  high: `E2E Rated 4.5 ${run}`,
  medium: `E2E Rated 3.0 ${run}`,
  unrated: `E2E Unrated ${run}`,
};

test.beforeAll(async () => {
  await createUser(email("chef"), "Rating Chef", 2, "password-123");
  await createUser(email("a"), "Rater A", 1, "password-123");
  await createUser(email("b"), "Rater B", 1, "password-123");
  const high = await insertRecipe(email("chef"), titles.high);
  const medium = await insertRecipe(email("chef"), titles.medium);
  await insertRecipe(email("chef"), titles.unrated);
  await insertReview(high, email("a"), 5, "Great");
  await insertReview(high, email("b"), 4, "Good");
  await insertReview(medium, email("a"), 3, "Fine");
  await insertReview(medium, email("b"), 3, "");
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

const card = (page: Page, title: string) =>
  page.locator("article", { hasText: title });

test("filter recipes by minimum average rating", async ({ page }) => {
  await page.goto("/");
  const select = page.getByLabel("Minimum rating");
  await expect(select.locator("option")).toHaveText([
    "Any",
    "1",
    "1.5",
    "2",
    "2.5",
    "3",
    "3.5",
    "4",
    "4.5",
    "5",
  ]);
  for (const title of Object.values(titles))
    await expect(card(page, title)).toBeVisible();

  // 4 and up: only the 4.5 recipe; unrated recipes are excluded
  await select.selectOption("4");
  await expect(page).toHaveURL(/minRating=4(&|$)/);
  await expect(card(page, titles.high)).toBeVisible();
  await expect(card(page, titles.medium)).toHaveCount(0);
  await expect(card(page, titles.unrated)).toHaveCount(0);

  // 3 and up: 3.0 is included (the threshold is inclusive)
  await select.selectOption("3");
  await expect(card(page, titles.medium)).toBeVisible();
  await expect(card(page, titles.high)).toBeVisible();
  await expect(card(page, titles.unrated)).toHaveCount(0);

  // 5 stars: neither average reaches it
  await select.selectOption("5");
  await expect(card(page, titles.high)).toHaveCount(0);

  // The filter is restored from a shared link, and "Clear filters" resets it
  await page.goto("/?minRating=4.5");
  await expect(select).toHaveValue("4.5");
  await expect(card(page, titles.high)).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(select).toHaveValue("");
  await expect(card(page, titles.unrated)).toBeVisible();
});
