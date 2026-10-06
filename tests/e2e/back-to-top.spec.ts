import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const chef = `backtotop-${run}@e2e.test`;
let recipeUrl = "";

// Enough recipes for the browse page to scroll, whatever else is in the database
test.beforeAll(async () => {
  await createUser(chef, "Scroll Chef", 2, "password-123");
  for (let i = 0; i < 12; i++) {
    const id = await insertRecipe(chef, `E2E Scroll ${run} #${i}`);
    if (i === 0) recipeUrl = `/recipes/${id}`;
  }
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

/** Opens the browse page and waits for its layout (masonry, fonts) to settle. */
async function openBrowse(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  // Late-loading fonts re-wrap text and re-measure the layout; let that finish
  await page.evaluate(() => document.fonts.ready);
}

const button = (page: Page) =>
  page.getByRole("button", { name: "Back to top" });
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
/** Scrolls instantly (the mouse wheel animates, so positions would still be moving). */
const scrollTo = (page: Page, y: number) =>
  page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);

test("appears when scrolled down and smoothly returns to the top", async ({
  page,
}) => {
  await openBrowse(page);
  await expect(button(page)).toBeHidden();

  await scrollTo(page, 1500);
  await expect(button(page)).toBeVisible();
  expect(await scrollY(page)).toBeGreaterThan(200);

  await button(page).click();
  // Smooth: still on its way right after the click, then at the top
  expect(await scrollY(page)).toBeGreaterThan(0);
  await expect.poll(() => scrollY(page)).toBe(0);
  await expect(button(page)).toBeHidden();
  await expect(
    page.getByRole("heading", { level: 1, name: "Browse recipes" }),
  ).toBeFocused();

  // And it comes back when scrolling down again
  await scrollTo(page, 800);
  await expect(button(page)).toBeVisible();
});

test("scrolls instantly for users who prefer reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openBrowse(page);
  await scrollTo(page, 1500);
  await expect(button(page)).toBeVisible();
  await button(page).click();
  expect(await scrollY(page)).toBe(0);
});

test("only shows on the browse page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto(recipeUrl);
  await scrollTo(page, 1500);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(200);
  await expect(button(page)).toHaveCount(0);
});
