import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe, recipeViews } from "./db";

const run = Date.now();
const password = "password-123";
const chef = `viewchef-${run}@e2e.test`;
const title = `E2E Viewable ${run}`;
let recipeId = "";

test.beforeAll(async () => {
  await createUser(chef, "View Chef", 2, password);
  recipeId = await insertRecipe(chef, title);
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

/** Opens the recipe and waits until its view has been reported. */
async function openRecipe(page: Page) {
  const reported = page.waitForResponse((r) =>
    r.url().endsWith(`/api/recipes/${recipeId}/view`),
  );
  await page.goto(`/recipes/${recipeId}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await reported;
}

test("a visit counts once per browser", async ({ browser }) => {
  const first = await browser.newPage();
  await openRecipe(first);
  expect(await recipeViews(recipeId)).toEqual({ total: 1, today: 1 });

  // Reloading is still the same view
  await openRecipe(first);
  expect(await recipeViews(recipeId)).toEqual({ total: 1, today: 1 });
  await first.context().close();

  const second = await browser.newPage();
  await openRecipe(second);
  expect(await recipeViews(recipeId)).toEqual({ total: 2, today: 2 });
  await second.context().close();
});

test("authors don't count as viewers of their own recipe", async ({ page }) => {
  const before = await recipeViews(recipeId);
  await page.goto(`/login?callbackUrl=${encodeURIComponent("/")}`);
  await page.getByLabel("Email").fill(chef);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await openRecipe(page);
  expect(await recipeViews(recipeId)).toEqual(before);
});
