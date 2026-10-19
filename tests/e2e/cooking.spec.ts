import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const password = "password-123";
const email = `cook-${run}@e2e.test`;
let recipeUrl = "";

test.beforeAll(async () => {
  await createUser(`chef-${email}`, `Cook Chef ${run}`, 2, password);
  await createUser(email, `Cook ${run}`, 1, password);
  const id = await insertRecipe(`chef-${email}`, `E2E Cooking ${run}`, {
    ingredients: ["Flour", "Eggs", "Milk"],
  });
  recipeUrl = `/recipes/${id}`;
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

const ingredients = (page: Page) =>
  page.getByRole("region", { name: "Ingredients" });

test("guests get the plain ingredient list", async ({ page }) => {
  await page.goto(recipeUrl);
  await expect(ingredients(page).getByText("Flour")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start cooking" })).toHaveCount(
    0,
  );
  await expect(ingredients(page).getByRole("checkbox")).toHaveCount(0);
});

test("the ingredients accordion starts open and collapses", async ({
  page,
}) => {
  await page.goto(recipeUrl);
  const trigger = page.getByRole("button", { name: /^Ingredients/ });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Flour")).toBeHidden();
  await trigger.click();
  await expect(ingredients(page).getByText("Flour")).toBeVisible();
});

test("a cook ticks what they have, kept on this device until they finish", async ({
  page,
}) => {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(recipeUrl)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await page.getByRole("button", { name: "Start cooking" }).click();
  await expect(ingredients(page).getByRole("checkbox")).toHaveCount(3);
  await ingredients(page).getByLabel("Flour").click();
  await ingredients(page).getByLabel("Milk").click();
  await expect(page.getByTestId("cooking-progress")).toHaveText(
    /2 of 3 ready, 1 to buy/,
  );

  // Still cooking, with the same ticks, after a reload
  await page.reload();
  await expect(ingredients(page).getByLabel("Flour")).toBeChecked();
  await expect(ingredients(page).getByLabel("Eggs")).not.toBeChecked();
  await expect(ingredients(page).getByLabel("Milk")).toBeChecked();

  await ingredients(page).getByLabel("Eggs").click();
  await expect(page.getByTestId("cooking-progress")).toHaveText(
    "You have everything. Happy cooking!",
  );

  // Finishing returns to the plain list and forgets the ticks
  await page.getByRole("button", { name: "Finish cooking" }).click();
  await expect(ingredients(page).getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Start cooking" }).click();
  await expect(ingredients(page).getByLabel("Flour")).not.toBeChecked();
});
