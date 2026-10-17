import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const chef = `loadmore-${run}@e2e.test`;

// At least two batches of 12 exist whatever else is in the database
test.beforeAll(async () => {
  await createUser(chef, "Load More Chef", 2, "password-123");
  for (let i = 0; i < 13; i++)
    await insertRecipe(chef, `E2E Feed ${run} #${i}`);
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

/** Opens the browse page and waits for its layout (masonry, fonts) to settle. */
async function openBrowse(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  // Late-loading fonts re-wrap text and re-measure the layout; let that finish
  await page.evaluate(() => document.fonts.ready);
}

// The feed's cards, not those in the rows above it
const cards = (page: Page) => page.locator("ul[data-masonry] article");
const cardLinks = (page: Page) =>
  cards(page)
    .locator("h2 a")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")));

test("'Load more' appends recipes and survives Back", async ({ page }) => {
  await openBrowse(page);
  await expect(cards(page)).toHaveCount(12);
  await expect(
    page.getByRole("navigation", { name: "Pagination" }),
  ).toHaveCount(0);
  // The test's own 13 recipes guarantee there's more than one batch
  await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();

  // Load the second batch
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(cards(page)).not.toHaveCount(12);
  const expected = await cards(page).count();
  expect(expected).toBeLessThanOrEqual(24);
  await expect(page).toHaveURL(/[?&]shown=24/);
  // Keyboard focus moves to the first new recipe
  await expect(cards(page).nth(12).locator("h2 a")).toBeFocused();
  const links = await cardLinks(page);
  expect(new Set(links).size).toBe(links.length); // no duplicates

  // Open a recipe from the second batch, then go Back: the longer list is restored
  const opened = links[13] ?? links[12];
  await page.locator(`article h2 a[href="${opened}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${opened}$`));
  await page.goBack();
  await expect(cards(page)).toHaveCount(expected);
  await expect(page.locator(`article h2 a[href="${opened}"]`)).toBeVisible();

  // Keep loading until the end
  const more = page.getByRole("button", { name: "Load more" });
  while (await more.isVisible()) {
    const before = await cards(page).count();
    await more.click();
    await expect(cards(page)).not.toHaveCount(before);
  }
  await expect(page.getByText("You've reached the end.")).toBeVisible();
  const all = await cardLinks(page);
  expect(all.length).toBeGreaterThan(expected);
  expect(new Set(all).size).toBe(all.length); // no duplicates
});

test("a recipe published while browsing goes to the top, without duplicates", async ({
  page,
}) => {
  await openBrowse(page);
  await expect(cards(page)).toHaveCount(12);
  const firstBatch = await cardLinks(page);

  await insertRecipe(chef, `E2E Feed ${run} newest`);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(cards(page)).not.toHaveCount(12);

  const all = await cardLinks(page);
  expect(new Set(all).size).toBe(all.length);
  await expect(cards(page).first()).toContainText(`E2E Feed ${run} newest`);
  // Everything from the first batch is still there, just one place lower
  expect(all.slice(1, 13)).toEqual(firstBatch);
});

test("changing a filter starts a fresh list", async ({ page }) => {
  await openBrowse(page, "/?shown=24");
  await expect(cards(page)).toHaveCount(24);
  await page
    .getByRole("region", { name: "Filter recipes" })
    .getByLabel("Max cooking time")
    .selectOption("15");
  await expect(page).toHaveURL(/maxTime=15/);
  await expect(page).not.toHaveURL(/shown=/);
  expect(await cards(page).count()).toBeLessThanOrEqual(12);
});

test("loading more keeps the scroll position (no skeleton flash)", async ({
  page,
}) => {
  await openBrowse(page);
  const button = page.getByRole("button", { name: "Load more" });
  await button.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);
  await button.click();
  await expect(cards(page)).not.toHaveCount(12);
  // The page didn't jump back to the top while loading
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(
    before - 5,
  );
});
