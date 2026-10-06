import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const chef = { email: `labelchef-${run}@e2e.test`, password: "password-123" };
const ALL_LABELS = [
  "VEGAN",
  "VEGETARIAN",
  "GLUTEN_FREE",
  "DAIRY_FREE",
  "SPICY",
  "DESSERT",
  "BREAKFAST",
  "QUICK",
];
let olderRecipe = "";

test.beforeAll(async () => {
  await createUser(chef.email, "Label Chef", 2, chef.password);
  // A recipe from before the limit, with all 8 labels
  olderRecipe = await insertRecipe(chef.email, `E2E Eight Labels ${run}`, {
    imageUrls: ["/api/uploads/e2e-labels.png"],
    labels: ALL_LABELS,
  });
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

async function logIn(page: Page, to: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(to)}`);
  await page.getByLabel("Email").fill(chef.email);
  await page.getByLabel("Password").fill(chef.password);
  await page.getByRole("button", { name: "Log in" }).click();
}

const labelBoxes = (page: Page) =>
  page.locator('[data-field="labels"]').getByRole("checkbox");

test("new recipes can have at most 7 labels", async ({ page }) => {
  await logIn(page, "/recipes/new");
  await expect(page.getByText("Choose up to 7 (0 selected).")).toBeVisible();

  const boxes = labelBoxes(page);
  await expect(boxes).toHaveCount(8);
  for (let i = 0; i < 7; i++) await boxes.nth(i).check({ force: true });

  await expect(page.getByText("Choose up to 7 (7 selected).")).toBeVisible();
  await expect(boxes.nth(7)).toBeDisabled();
  // Unticking one frees a slot again
  await boxes.nth(0).uncheck({ force: true });
  await expect(boxes.nth(7)).toBeEnabled();
});

test("an older recipe keeps its 8 labels and can still be edited", async ({
  page,
}) => {
  await logIn(page, `/recipes/${olderRecipe}/edit`);
  await expect(page.getByText("Choose up to 8 (8 selected).")).toBeVisible();
  for (const box of await labelBoxes(page).all())
    await expect(box).toBeChecked();

  await page.getByLabel("Title").fill(`E2E Eight Labels ${run} (edited)`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `E2E Eight Labels ${run} (edited)`,
  );
  // All 8 label badges are still on the recipe (plus the cooking-time badge)
  await expect(
    page.locator("header").getByText("Breakfast", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByText("Quick", { exact: true }),
  ).toBeVisible();
});
