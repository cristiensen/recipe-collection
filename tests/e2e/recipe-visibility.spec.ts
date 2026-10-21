import { type Browser, expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe, userId } from "./db";

const run = Date.now();
const password = "password-123";
const email = (who: string) => `hidden${who}-${run}@e2e.test`;
const title = `E2E Hidden Recipe ${run}`;
let authorId = "";
let recipeUrl = "";

test.beforeAll(async () => {
  await createUser(email("author"), `Hidden Author ${run}`, 2, password);
  await createUser(email("chef"), `Hidden Chef ${run}`, 2, password);
  await createUser(email("fan"), `Hidden Fan ${run}`, 1, password);
  recipeUrl = `/recipes/${await insertRecipe(email("author"), title)}`;
  // A public recipe so the feed isn't empty (and unrendered) for guests once
  // the one above is hidden, e.g. on CI's fresh database
  await insertRecipe(email("chef"), `E2E Public Recipe ${run}`);
  authorId = await userId(email("author"));
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

async function session(browser: Browser, who: string | null, to: string) {
  const page = await browser.newPage();
  if (who) {
    await page.goto(`/login?callbackUrl=${encodeURIComponent(to)}`);
    await page.getByLabel("Email").fill(email(who));
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  } else {
    await page.goto(to);
  }
  return page;
}

const browseTitles = async (page: Page) => {
  await page.goto("/?shown=240");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  return page.locator("article h2").allInnerTexts();
};

test("the author hides a recipe from the public on its page", async ({
  browser,
}) => {
  const author = await session(browser, "author", recipeUrl);
  const toggle = author.getByRole("switch", { name: `${title} is public` });
  await expect(toggle).toBeChecked();
  await expect(author.getByTestId("not-public-notice")).toHaveCount(0);
  await toggle.click();
  await expect(
    author.getByText(`“${title}” is now hidden from the public`),
  ).toBeVisible();
  await expect(author.getByTestId("not-public-notice")).toBeVisible();
  await author.context().close();

  // Guests and regular users: not found, not listed
  for (const who of [null, "fan"] as const) {
    const page = await session(browser, who, "/");
    expect((await page.goto(recipeUrl))?.status()).toBe(404);
    expect(await browseTitles(page)).not.toContain(title);
    await page.goto(`/users/${authorId}`);
    await expect(page.getByText(title)).toHaveCount(0);
    await page.context().close();
  }

  // Other chefs: visible, with the notice and a badge, but no switch
  const chef = await session(browser, "chef", "/");
  expect(await browseTitles(chef)).toContain(title);
  await expect(
    chef.locator("article", { hasText: title }).getByText("Not public"),
  ).toBeVisible();
  await chef.goto(recipeUrl);
  await expect(chef.getByTestId("not-public-notice")).toHaveText(
    /This recipe is not public/,
  );
  await expect(
    chef.getByRole("switch", { name: `${title} is public` }),
  ).toHaveCount(0);
  await chef.context().close();
});

test("the author makes it public again from Settings", async ({ browser }) => {
  const author = await session(
    browser,
    "author",
    `/users/${authorId}?tab=settings`,
  );
  await expect(
    author.getByRole("heading", { name: "Recipe visibility" }),
  ).toBeVisible();
  const toggle = author.getByRole("switch", { name: `${title} is public` });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(author.getByText(`“${title}” is now public`)).toBeVisible();
  await author.context().close();

  const guest = await session(browser, null, recipeUrl);
  await expect(
    guest.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  await expect(guest.getByTestId("not-public-notice")).toHaveCount(0);
  await guest.context().close();
});
