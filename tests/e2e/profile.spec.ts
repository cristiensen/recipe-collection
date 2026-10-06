import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  banUser,
  createUser,
  deleteUsers,
  insertRecipe,
  likeRecipe,
  userId,
} from "./db";

const run = Date.now();
const password = "password-123";
const email = (who: string) => `profile${who}-${run}@e2e.test`;
const chefName = `Profile Chef ${run}`;
const fanName = `Profile Fan ${run}`;
const soup = `E2E Profile Soup ${run}`;
const pie = `E2E Profile Pie ${run}`;
let chefId = "";
let fanId = "";

test.beforeAll(async () => {
  await createUser(email("chef"), chefName, 2, password);
  await createUser(email("fan"), fanName, 1, password);
  await insertRecipe(email("chef"), soup);
  const pieId = await insertRecipe(email("chef"), pie);
  await likeRecipe(pieId, email("fan"));
  chefId = await userId(email("chef"));
  fanId = await userId(email("fan"));
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

async function logIn(page: Page, address: string, pass = password, to = "/") {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(to)}`);
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(pass);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function newSession(browser: Browser, address: string, to: string) {
  const page = await browser.newPage();
  await logIn(page, address, password, to);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  return page;
}

const stat = (page: Page, label: string) =>
  page
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("dd");
const tabs = (page: Page) =>
  page.getByRole("navigation", { name: "Profile sections" });
const cardTitles = (page: Page) => page.locator("article h2").allInnerTexts();

test("anyone can view a public profile with recipes, stats and likes", async ({
  page,
}) => {
  await page.goto(`/users/${chefId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: chefName }),
  ).toBeVisible();
  await expect(page.getByText("Chef", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Member since /)).toBeVisible();
  await expect(stat(page, "Recipes")).toHaveText("2");
  await expect(stat(page, "Reviews")).toHaveText("0");
  await expect(stat(page, "Likes received")).toHaveText("1");
  expect(await cardTitles(page)).toEqual([pie, soup]); // newest first
  await expect(tabs(page).getByRole("link", { name: "Settings" })).toHaveCount(
    0,
  );

  // Liked tab of the fan
  await page.goto(`/users/${fanId}`);
  await expect(
    page.getByText(`${fanName} hasn't published any recipes yet.`),
  ).toBeVisible();
  await tabs(page).getByRole("link", { name: "Liked" }).click();
  await expect(page).toHaveURL(/tab=liked/);
  await expect(page.locator("article h2")).toHaveText([pie]);

  // Settings can't be opened on someone else's profile
  await page.goto(`/users/${chefId}?tab=settings`);
  await expect(page.getByRole("heading", { name: "Password" })).toHaveCount(0);
  expect(await cardTitles(page)).toEqual([pie, soup]);
});

test("names link to profiles", async ({ browser }) => {
  const page = await newSession(browser, email("fan"), "/");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  // The author link on a browse card opens the profile, not the recipe
  await page
    .locator("article", { hasText: soup })
    .getByRole("link", { name: chefName })
    .click();
  await expect(page).toHaveURL(new RegExp(`/users/${chefId}$`));
  // The header links to your own profile
  await page.getByRole("link", { name: `Your profile (${fanName})` }).click();
  await expect(page).toHaveURL(new RegExp(`/users/${fanId}$`));
  await expect(
    tabs(page).getByRole("link", { name: "Settings" }),
  ).toBeVisible();
  await page.context().close();
});

test("owners can change their display name and password", async ({
  browser,
}) => {
  const page = await newSession(
    browser,
    email("chef"),
    `/users/${chefId}?tab=settings`,
  );

  // Display name
  const newName = `${chefName} Renamed`;
  await page.getByLabel("Display name").fill(newName);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Display name updated")).toBeVisible();
  await expect(page.getByTestId("header-user-name")).toHaveText(newName);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(newName);

  // Password: wrong current password, then a mismatch, then success
  const current = page.getByLabel("Current password");
  const next = page.getByLabel("New password", { exact: true });
  const confirm = page.getByLabel("Confirm new password");
  const save = page.getByRole("button", { name: "Change password" });

  await current.fill("wrong-password");
  await next.fill("brand-new-pass");
  await confirm.fill("brand-new-pass");
  await save.click();
  await expect(page.getByText("Current password is incorrect")).toBeVisible();

  await current.fill(password);
  await next.fill("brand-new-pass");
  await confirm.fill("something-else");
  await save.click();
  await expect(page.getByText("Passwords don't match")).toBeVisible();

  await current.fill(password);
  await next.fill("brand-new-pass");
  await confirm.fill("brand-new-pass");
  await save.click();
  await expect(page.getByText("Password changed")).toBeVisible();
  await expect(current).toHaveValue(""); // fields cleared
  await page.context().close();

  // The old password no longer works; the new one does
  const fresh = await browser.newPage();
  await logIn(fresh, email("chef"), password);
  await expect(fresh.getByText("Invalid email or password")).toBeVisible();
  await logIn(fresh, email("chef"), "brand-new-pass");
  await expect(fresh.getByRole("button", { name: "Log out" })).toBeVisible();
  await fresh.context().close();
});

test("owners can delete their account", async ({ browser }) => {
  await createUser(email("leaver"), "Leaving Soon", 2, password);
  await insertRecipe(email("leaver"), `E2E Leaver Recipe ${run}`);
  const leaverId = await userId(email("leaver"));
  const page = await newSession(
    browser,
    email("leaver"),
    `/users/${leaverId}?tab=settings`,
  );

  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Password").fill("wrong-password");
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(dialog.getByText("Password is incorrect")).toBeVisible();

  await dialog.getByLabel("Password").fill(password);
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "Log in", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(`E2E Leaver Recipe ${run}`)).toHaveCount(0);
  expect((await page.goto(`/users/${leaverId}`))?.status()).toBe(404);
  await page.context().close();
});

test("banned users can't change their display name", async ({ browser }) => {
  await createUser(email("banned"), "Banned Person", 1, password);
  await banUser(email("banned"));
  const id = await userId(email("banned"));
  const page = await newSession(
    browser,
    email("banned"),
    `/users/${id}?tab=settings`,
  );
  await expect(page.getByLabel("Display name")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save name" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Change password" }),
  ).toBeEnabled();
  await page.context().close();
});
