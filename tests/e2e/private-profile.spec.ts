import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  createUser,
  deleteUsers,
  insertRecipe,
  insertReview,
  likeRecipe,
  userId,
} from "./db";

const run = Date.now();
const password = "password-123";
const email = (who: string) => `private${who}-${run}@e2e.test`;
const chefName = `Private Chef ${run}`;
const secret = `E2E Secret Recipe ${run}`;
const open = `E2E Open Recipe ${run}`;
const secretReview = `Private chef's review ${run}`;
let chefId = "";
let secretUrl = "";
let openUrl = "";

test.beforeAll(async () => {
  await createUser(email("chef"), chefName, 2, password);
  await createUser(email("other"), `Open Chef ${run}`, 2, password);
  await createUser(email("fan"), `Private Fan ${run}`, 1, password);
  await createUser(email("mod"), `Private Mod ${run}`, 10, password);
  secretUrl = `/recipes/${await insertRecipe(email("chef"), secret)}`;
  const openId = await insertRecipe(email("other"), open);
  openUrl = `/recipes/${openId}`;
  // The chef reviews someone else's recipe (5★); the fan rates it 1★
  await insertReview(openId, email("chef"), 5, secretReview);
  await insertReview(openId, email("fan"), 1, `Fan review ${run}`);
  // The fan liked the chef's recipe while it was public
  await likeRecipe(secretUrl.split("/").pop() ?? "", email("fan"));
  chefId = await userId(email("chef"));
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

async function setVisibility(browser: Browser, value: "Public" | "Private") {
  const page = await session(browser, "chef", `/users/${chefId}?tab=settings`);
  await page.getByRole("radio", { name: new RegExp(`^${value}`) }).check();
  await page.getByRole("button", { name: "Save visibility" }).click();
  await expect(
    page.getByText(`Your profile is now ${value.toLowerCase()}`),
  ).toBeVisible();
  await page.context().close();
}

const browseTitles = async (page: Page) => {
  await page.goto("/?shown=240");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  return page.locator("article h2").allInnerTexts();
};

test("a private profile is hidden from everyone but the owner and staff", async ({
  browser,
}) => {
  await setVisibility(browser, "Private");

  // Guests and regular users: not found, not listed, review hidden
  for (const who of [null, "fan"] as const) {
    const page = await session(browser, who, "/");
    expect((await page.goto(`/users/${chefId}`))?.status()).toBe(404);
    expect((await page.goto(secretUrl))?.status()).toBe(404);
    expect(await browseTitles(page)).not.toContain(secret);

    await page.goto(openUrl);
    await expect(
      page.getByTestId("review-list").getByText(secretReview),
    ).toHaveCount(0);
    // ...but the hidden review's rating still counts: (5 + 1) / 2
    await expect(page.getByTestId("rating-summary")).toHaveText(
      "3.0 from 2 ratings",
    );
    await page.context().close();
  }

  // The fan's own Liked tab no longer shows the private recipe
  const fan = await session(browser, "fan", "/");
  const fanId = await userId(email("fan"));
  await fan.goto(`/users/${fanId}?tab=liked`);
  await expect(fan.getByText(secret)).toHaveCount(0);
  await fan.context().close();

  // Owner and moderator: everything, marked Private
  for (const who of ["chef", "mod"] as const) {
    const page = await session(browser, who, "/");
    expect(await browseTitles(page)).toContain(secret);
    await expect(
      page
        .locator("article", { hasText: secret })
        .getByText("Private", { exact: true }),
    ).toBeVisible();
    await page.goto(`/users/${chefId}`);
    await expect(
      page.getByRole("main").getByText("Private", { exact: true }).first(),
    ).toBeVisible();
    await page.goto(secretUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: secret }),
    ).toBeVisible();
    await page.goto(openUrl);
    await expect(
      page.getByTestId("review-list").getByText(secretReview),
    ).toBeVisible();
    await page.context().close();
  }

  // Back to public: visible again for guests
  await setVisibility(browser, "Public");
  const guest = await session(browser, null, `/users/${chefId}`);
  await expect(
    guest.getByRole("heading", { level: 1, name: chefName }),
  ).toBeVisible();
  await guest.goto(openUrl);
  await expect(
    guest.getByTestId("review-list").getByText(secretReview),
  ).toBeVisible();
  await guest.context().close();
});

test("regular users don't get the visibility setting", async ({ browser }) => {
  const fanId = await userId(email("fan"));
  const page = await session(browser, "fan", `/users/${fanId}?tab=settings`);
  await expect(
    page.getByRole("heading", { name: "Display name" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Profile visibility" }),
  ).toHaveCount(0);
  await page.context().close();
});
