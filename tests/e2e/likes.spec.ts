import { type Browser, expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const password = "password-123";
const chef = `likechef-${run}@e2e.test`;
const fan = `likefan-${run}@e2e.test`;
const title = `E2E Likeable ${run}`;
let recipeUrl = "";

test.beforeAll(async () => {
  await createUser(chef, "Like Chef", 2, password);
  await createUser(fan, "Like Fan", 1, password);
  const id = await insertRecipe(chef, title);
  recipeUrl = `/recipes/${id}`;
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

async function logIn(browser: Browser, email: string, to: string) {
  const page = await browser.newPage();
  await page.goto(`/login?callbackUrl=${encodeURIComponent(to)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  return page;
}

/** The recipe's heart, wherever it is on the page. */
const heart = (page: Page) =>
  page.getByRole("button", { name: new RegExp(`^Like ${title}`) });
const card = (page: Page) => page.locator("article", { hasText: title });
const heartIcon = (page: Page) => heart(page).locator("svg");

test("like and unlike from a browse card", async ({ browser }) => {
  const page = await logIn(browser, fan, "/");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  const button = card(page).getByRole("button", {
    name: new RegExp(`^Like ${title}`),
  });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toHaveAccessibleName(`Like ${title} (0 likes)`);
  await expect(button.locator("svg")).not.toHaveClass(/fill-red-500/);

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toHaveAccessibleName(`Like ${title} (1 like)`);
  await expect(button.locator("svg")).toHaveClass(/fill-red-500/); // filled heart
  await expect(page).toHaveURL(/\/$/); // the click didn't open the recipe

  // Saved: still liked after a reload
  await page.reload();
  await expect(
    card(page).getByRole("button", { name: `Like ${title} (1 like)` }),
  ).toHaveAttribute("aria-pressed", "true");

  await card(page)
    .getByRole("button", { name: new RegExp(`^Like ${title}`) })
    .click();
  await expect(
    card(page).getByRole("button", { name: `Like ${title} (0 likes)` }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.context().close();
});

test("like on the recipe page shows on the browse page after Back", async ({
  browser,
}) => {
  const page = await logIn(browser, fan, "/");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  await card(page).getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`${recipeUrl}$`));

  await heart(page).click();
  await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
  await expect(heartIcon(page)).toHaveClass(/fill-red-500/);

  await page.goBack();
  await expect(
    card(page).getByRole("button", { name: `Like ${title} (1 like)` }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.context().close();
});

test("authors who try to like their own recipe are told why", async ({
  browser,
}) => {
  const page = await logIn(browser, chef, recipeUrl);
  await expect(heart(page)).toHaveAttribute("aria-disabled", "true");
  const name = await heart(page).getAttribute("aria-label");

  // Playwright treats aria-disabled buttons as not clickable; browsers don't
  await heart(page).click({ force: true });
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "You can't like your own recipe" }),
  ).toBeVisible();
  // Nothing changed
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
  await expect(heart(page)).toHaveAttribute("aria-label", name ?? "");

  // Keyboard users get the same message
  await page.keyboard.press("Escape");
  await heart(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "You can't like your own recipe" }),
  ).not.toHaveCount(0);
  await page.context().close();
});

test("guests are sent to log in, then back", async ({ page }) => {
  await page.goto(recipeUrl);
  await page
    .getByRole("link", { name: new RegExp(`^Like ${title}.*log in to like`) })
    .click();
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await page.getByLabel("Email").fill(fan);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp(`${recipeUrl}$`));
  await expect(heart(page)).toBeEnabled();
});
