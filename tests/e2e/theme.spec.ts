import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { deleteUsers } from "./db";

const run = Date.now();
const password = "password-123";
const email = (who: string) => `theme-${who}-${run}@e2e.test`;

test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

const isDark = (page: Page) =>
  expect(page.locator("html")).toHaveClass(/\bdark\b/);
const isLight = (page: Page) =>
  expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

const themeCookie = async (context: BrowserContext) =>
  (await context.cookies()).find((c) => c.name === "theme")?.value;

/** Clicks the header toggle and waits until the server has saved the choice. */
async function toggleTo(page: Page, theme: "dark" | "light") {
  await page.getByRole("switch", { name: "Dark blue theme" }).click();
  await expect.poll(() => themeCookie(page.context())).toBe(theme);
}

async function signUp(page: Page, address: string) {
  await page.goto("/signup");
  await page.getByLabel("Display name").fill("Theme tester");
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function logIn(page: Page, address: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function logOut(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(
    page.getByRole("link", { name: "Log in", exact: true }),
  ).toBeVisible();
}

test("guests: dark blue by default, toggle persists in a cookie", async ({
  page,
}) => {
  await page.goto("/");
  await isDark(page);
  await expect(
    page.getByRole("switch", { name: "Dark blue theme" }),
  ).toHaveAttribute("aria-checked", "true");

  await toggleTo(page, "light");
  await page.reload();
  await isLight(page);

  await toggleTo(page, "dark");
  await page.reload();
  await isDark(page);
});

test("logged-in preference follows the user to another device", async ({
  browser,
}) => {
  const address = email("sync");

  // Device A: sign up and switch to light
  const deviceA = await browser.newPage();
  await signUp(deviceA, address);
  await isDark(deviceA);
  await toggleTo(deviceA, "light");

  // Device B: fresh browser (no cookie) → light after logging in
  const deviceB = await browser.newPage();
  await deviceB.goto("/");
  await isDark(deviceB);
  await logIn(deviceB, address);
  await isLight(deviceB);

  // Changing it on A shows up on B at the next reload (read from the account)
  await toggleTo(deviceA, "dark");
  await deviceB.reload();
  await isDark(deviceB);

  // After logging out, B keeps the user's theme instead of jumping back
  await toggleTo(deviceB, "light");
  await logOut(deviceB);
  await isLight(deviceB);

  // A guest change on B doesn't override the account at the next login
  await toggleTo(deviceB, "dark");
  await logIn(deviceB, address);
  await isLight(deviceB);

  await deviceA.context().close();
  await deviceB.context().close();
});

test("a theme picked as a guest is kept when signing up", async ({
  browser,
}) => {
  const address = email("adopt");

  const guest = await browser.newPage();
  await guest.goto("/");
  await toggleTo(guest, "light");
  await signUp(guest, address);
  await isLight(guest);

  // The choice was saved to the new account, so another device gets it too
  const other = await browser.newPage();
  await logIn(other, address);
  await isLight(other);

  await guest.context().close();
  await other.context().close();
});
