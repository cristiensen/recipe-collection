import { expect, type Page, test } from "@playwright/test";
import { addRecipeViews, createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const chef = `hotchef-${run}@e2e.test`;
const hottest = `E2E Hottest ${run}`;
const warm = `E2E Warm Dessert ${run}`;
const stale = `E2E Stale ${run}`;

// The row ranks every recipe in the database, so these get far more views
// than anything else a test run creates
const MANY = 1_000_000;

test.beforeAll(async () => {
  await createUser(chef, "Hot Chef", 2, "password-123");
  // Views split over the week still add up: 2 × MANY + 2 beats MANY + 20
  const hottestId = await insertRecipe(chef, hottest);
  await addRecipeViews(hottestId, MANY + 1);
  await addRecipeViews(hottestId, MANY + 1, 6);
  const warmId = await insertRecipe(chef, warm, { labels: ["dessert"] });
  await addRecipeViews(warmId, MANY + 20, 3);
  // Seven days back is past "this week", however many views it had
  const staleId = await insertRecipe(chef, stale);
  await addRecipeViews(staleId, 10 * MANY, 7);
  for (let i = 0; i < 15; i++) {
    await addRecipeViews(
      await insertRecipe(chef, `E2E Popular ${i} ${run}`),
      MANY - i,
    );
  }
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

const row = (page: Page) =>
  page.getByRole("region", { name: "Hottest this week" });
const rowTitles = (page: Page) => row(page).getByRole("heading", { level: 3 });

test("guests see the week's most viewed recipes, most viewed first, at most 15", async ({
  page,
}) => {
  await page.goto("/");
  await expect(rowTitles(page)).toHaveCount(15);
  await expect(rowTitles(page).nth(0)).toHaveText(hottest);
  await expect(rowTitles(page).nth(1)).toHaveText(warm);
  await expect(rowTitles(page).nth(2)).toHaveText(`E2E Popular 0 ${run}`);
  await expect(row(page).getByText(stale)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "All recipes" }),
  ).toBeVisible();
});

test("follows the filters", async ({ page }) => {
  await page.goto("/?labels=dessert");
  await expect(rowTitles(page).first()).toHaveText(warm);
  await expect(row(page).getByText(hottest)).toHaveCount(0);
});
