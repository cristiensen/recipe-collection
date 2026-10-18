import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const email = `search-${run}@e2e.test`;
// A word only these recipes contain, so results don't depend on other data
const word = `zest${run}`;
const SOUP = `E2E ${word} soup`;
const SALAD = `E2E ${word} salad`;

test.beforeAll(async () => {
  await createUser(email, "Search Chef", 2, "password-123");
  await insertRecipe(email, SOUP, { labels: ["VEGAN"] });
  await insertRecipe(email, SALAD, { labels: ["SPICY"] });
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

const box = (page: Page) =>
  page.locator("header").getByRole("searchbox", { name: "Search recipes" });
const titles = (page: Page) =>
  page.locator("ul[data-masonry] article h2").allInnerTexts();

test("results update as you type, and searching resets the filters", async ({
  page,
}) => {
  await page.goto("/?labels=spicy&sort=oldest");
  await box(page).pressSequentially(word);
  await expect(page).toHaveURL(`/?q=${word}&sort=oldest`);
  await expect(
    page.getByRole("heading", { name: `2 recipes matching “${word}”` }),
  ).toBeVisible();
  expect(await titles(page)).toEqual([SOUP, SALAD]);
  await expect(
    page.getByRole("checkbox", { name: "Spicy", exact: true }),
  ).not.toBeChecked();

  // Filtering keeps the search
  await page
    .getByRole("region", { name: "Filter recipes" })
    .getByText("Vegan", { exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`q=${word}.*labels=vegan`));
  await expect.poll(() => titles(page)).toEqual([SOUP]);

  // More words narrow it down, and a new search drops the filter again
  await box(page).press("End");
  await box(page).pressSequentially(" sal");
  await expect(page).toHaveURL(`/?q=${word}+sal&sort=oldest`);
  await expect.poll(() => titles(page)).toEqual([SALAD]);

  // No matches
  await box(page).pressSequentially("xyz");
  await expect(
    page.getByRole("heading", { name: `No recipes match “${word} salxyz”` }),
  ).toBeVisible();

  // Clearing goes back to every recipe
  await page
    .locator("header")
    .getByRole("button", { name: "Clear search" })
    .click();
  await expect(page).toHaveURL("/?sort=oldest");
  await expect(box(page)).toHaveValue("");
  await expect(box(page)).toBeFocused();
});

test("searching from another page opens the results, and Back returns", async ({
  page,
}) => {
  await page.goto("/login");
  await box(page).fill(`${word} soup`);
  await expect(page).toHaveURL(`/?q=${word}+soup`);
  await expect.poll(() => titles(page)).toEqual([SOUP]);

  // The box follows the URL
  await page.getByRole("link", { name: SOUP, exact: true }).click();
  await expect(page).toHaveURL(/\/recipes\//);
  await expect(box(page)).toHaveValue("");
  await page.goBack();
  await expect(box(page)).toHaveValue(`${word} soup`);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
});

test("recipes match by the names of their labels too", async ({ page }) => {
  await page.goto("/");
  // Neither title, description nor ingredients say "spicy" or "vegan"
  await box(page).fill(`${word} spicy`);
  await expect(page).toHaveURL(`/?q=${word}+spicy`);
  await expect.poll(() => titles(page)).toEqual([SALAD]);
  await box(page).fill(`${word} VEG`);
  await expect.poll(() => titles(page)).toEqual([SOUP]);
});
