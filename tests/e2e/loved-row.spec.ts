import { type Browser, expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe, likeRecipe } from "./db";

const run = Date.now();
const password = "password-123";
const chef = `lovechef-${run}@e2e.test`;
const fan = `lovefan-${run}@e2e.test`;
const collector = `lovecollector-${run}@e2e.test`;
const nobody = `lovenobody-${run}@e2e.test`;
const vegan = `E2E Loved Vegan ${run}`;
const plain = `E2E Loved Plain ${run}`;
const spicy = `E2E Unloved Spicy ${run}`;

test.beforeAll(async () => {
  await createUser(chef, "Love Chef", 2, password);
  await createUser(fan, "Love Fan", 1, password);
  await createUser(collector, "Love Collector", 1, password);
  await createUser(nobody, "Love Nobody", 1, password);
  const veganId = await insertRecipe(chef, vegan, { labels: ["VEGAN"] });
  const plainId = await insertRecipe(chef, plain);
  await insertRecipe(chef, spicy, { labels: ["SPICY"] });
  // Liked in this order, so the plain one is the most recent
  await likeRecipe(veganId, fan);
  await likeRecipe(plainId, fan);
  for (let i = 0; i < 16; i++) {
    await likeRecipe(
      await insertRecipe(chef, `E2E Hoard ${i} ${run}`),
      collector,
    );
  }
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

const row = (page: Page) => page.getByRole("region", { name: "What you love" });
const rowTitles = (page: Page) => row(page).getByRole("heading", { level: 3 });

test("shows the viewer's likes, latest first, above all recipes", async ({
  browser,
}) => {
  const page = await logIn(browser, fan, "/");
  await expect(rowTitles(page)).toHaveText([plain, vegan]);
  await expect(
    page.getByRole("heading", { name: "All recipes" }),
  ).toBeVisible();
  // The normal results follow
  await expect(page.locator("ul[data-masonry='on'] article")).toHaveCount(12);
  await page.context().close();
});

test("follows the filters, and disappears when none of the likes match", async ({
  browser,
}) => {
  const page = await logIn(browser, fan, "/?labels=vegan");
  await expect(rowTitles(page)).toHaveText([vegan]);
  // Liked recipes stay in the normal results too
  await expect(
    page.locator("ul[data-masonry] article", { hasText: vegan }),
  ).toBeVisible();

  await page.goto("/?labels=spicy");
  await expect(
    page.locator("ul[data-masonry] article", { hasText: spicy }),
  ).toBeVisible();
  await expect(row(page)).toHaveCount(0);
  await page.context().close();
});

test("unliking from the row removes the recipe from it", async ({
  browser,
}) => {
  const page = await logIn(browser, fan, "/");
  await row(page)
    .getByRole("button", { name: new RegExp(`^Like ${plain}`) })
    .click();
  await expect(rowTitles(page)).toHaveText([vegan]);
  await page.context().close();
});

test("shows at most 15 and pages sideways with the arrows", async ({
  browser,
}) => {
  const page = await logIn(browser, collector, "/");
  await expect(rowTitles(page)).toHaveCount(15);
  await expect(rowTitles(page).first()).toHaveText(`E2E Hoard 15 ${run}`);

  const list = row(page).getByRole("list");
  const back = row(page).getByRole("button", { name: /back$/ });
  const forward = row(page).getByRole("button", { name: /forward$/ });
  await expect(back).toBeHidden();
  await forward.click();
  await expect
    .poll(() => list.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  await expect(back).toBeVisible();
  // The arrows land with a card in the row's center
  const centered = () =>
    list.evaluate((el) => {
      const row = el.getBoundingClientRect();
      const middle = row.left + row.width / 2;
      return [...el.children].findIndex((item) => {
        const box = item.getBoundingClientRect();
        return Math.abs(box.left + box.width / 2 - middle) < 1;
      });
    });
  await expect.poll(centered).toBeGreaterThan(0);
  const first = await centered();
  await forward.click();
  await expect.poll(centered).toBe(first + 1);
  await back.click();
  await expect.poll(centered).toBe(first);
  await page.context().close();
});

test("the mouse wheel scrolls the row sideways while hovered", async ({
  browser,
}) => {
  const page = await logIn(browser, collector, "/");
  const list = row(page).getByRole("list");
  await expect(rowTitles(page)).toHaveCount(15);
  await list.hover();
  const pageY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 100);
  await expect
    .poll(() => list.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageY);

  // The wheel never snaps: the row stays where the wheel left it
  const scrolled = await list.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(800);
  expect(await list.evaluate((el) => el.scrollLeft)).toBe(scrolled);
  await page.context().close();
});

test("guests and accounts without likes see no row", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  await expect(row(page)).toHaveCount(0);
  await page.context().close();

  const other = await logIn(browser, nobody, "/");
  await expect(other.locator("ul[data-masonry='on']")).toBeVisible();
  await expect(row(other)).toHaveCount(0);
  await other.context().close();
});
