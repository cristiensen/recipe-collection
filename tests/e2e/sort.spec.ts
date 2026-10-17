import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe, insertReview } from "./db";

const run = Date.now();
const email = (who: string) => `sort${who}-${run}@e2e.test`;
// Inserted oldest → newest: A, B, C
const A = `E2E Sort A ${run}`; // 2 min, rated 5
const B = `E2E Sort B ${run}`; // 1 min, rated 2
const C = `E2E Sort C ${run}`; // 3 min, unrated

test.beforeAll(async () => {
  await createUser(email("chef"), "Sort Chef", 2, "password-123");
  await createUser(email("rater"), "Sort Rater", 1, "password-123");
  const a = await insertRecipe(email("chef"), A, { cookingMinutes: 2 });
  const b = await insertRecipe(email("chef"), B, { cookingMinutes: 1 });
  await insertRecipe(email("chef"), C, { cookingMinutes: 3 });
  await insertReview(a, email("rater"), 5, "Excellent");
  await insertReview(b, email("rater"), 2, "Meh");
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

/** All card titles on the page, in order (loads the whole list via ?shown). */
async function titlesFor(page: Page, sort: string) {
  await page.goto(`/?sort=${sort}&shown=240`);
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  return page.locator("ul[data-masonry] article h2").allInnerTexts();
}
const order = (titles: string[]) => titles.filter((t) => [A, B, C].includes(t));

const expected: Record<string, string[]> = {
  newest: [C, B, A],
  oldest: [A, B, C],
  "rating-desc": [A, B, C],
  "rating-asc": [B, A, C],
  "time-asc": [B, A, C],
  "time-desc": [C, A, B],
};

for (const [sort, want] of Object.entries(expected)) {
  test(`sorts by ${sort}`, async ({ page }) => {
    expect(order(await titlesFor(page, sort))).toEqual(want);
  });
}

test("unrated recipes come last in both rating orders", async ({ page }) => {
  for (const sort of ["rating-desc", "rating-asc"]) {
    await titlesFor(page, sort);
    const rated = await page
      .locator("ul[data-masonry] article")
      .evaluateAll((cards) =>
        cards.map((c) => !c.textContent?.includes("No ratings yet")),
      );
    const firstUnrated = rated.indexOf(false);
    expect(firstUnrated).toBeGreaterThan(0);
    expect(rated.slice(firstUnrated)).not.toContain(true);
  }
});

test("the dropdown updates the URL, and Clear filters keeps the sort", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  const select = page.getByLabel("Sort by");
  await expect(select).toHaveValue("newest");
  await select.selectOption("time-asc");
  await expect(page).toHaveURL(/sort=time-asc/);
  await expect(page.locator("article h2").first()).toHaveText(B);

  await page.getByLabel("Max cooking time").selectOption("15");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/maxTime/);
  await expect(page).toHaveURL(/sort=time-asc/);
  await expect(select).toHaveValue("time-asc");
});
