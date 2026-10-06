import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe, userId } from "./db";

const run = Date.now();
const password = "password-123";
const email = (who: string) => `menu${who}-${run}@e2e.test`;

test.beforeAll(async () => {
  await createUser(email("chef"), `Menu Chef ${run}`, 2, password);
  await createUser(email("mod"), `Menu Mod ${run}`, 10, password);
  // Enough recipes for the browse page to scroll
  for (let i = 0; i < 12; i++)
    await insertRecipe(email("chef"), `E2E Menu ${run} #${i}`);
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

const PHONE = { width: 390, height: 800 };
const TABLET = { width: 800, height: 1000 };
const DESKTOP = { width: 1280, height: 800 };

const header = (page: Page) => page.locator("header");
const menuButton = (page: Page) =>
  header(page).getByRole("button", { name: "Menu" });
const menu = (page: Page) => page.getByRole("menu");

async function logIn(page: Page, who: string, to = "/") {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(to)}`);
  await page.getByLabel("Email").fill(email(who));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(
    header(page).getByRole("link", { name: /^Your profile/ }),
  ).toBeVisible();
}

for (const [name, size] of [
  ["phone", PHONE],
  ["tablet", TABLET],
] as const) {
  test(`on a ${name}, only the profile link and the menu are in the header`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await logIn(page, "chef");
    const visible = header(page).locator("a:visible, button:visible");
    // Logo, profile, menu
    await expect(visible).toHaveCount(3);
    await expect(
      header(page).getByRole("link", { name: /^Your profile/ }),
    ).toBeVisible();
    await expect(menuButton(page)).toBeVisible();
    for (const hidden of ["New recipe", "Log out"]) {
      await expect(
        header(page).getByRole("button", { name: hidden }),
      ).toBeHidden();
      await expect(
        header(page).getByRole("link", { name: hidden }),
      ).toBeHidden();
    }

    await menuButton(page).click();
    await expect(menu(page).getByRole("menuitem")).toHaveText([
      "New recipe",
      "Switch to light theme",
      "Log out",
    ]);
    await menu(page).getByRole("menuitem", { name: "New recipe" }).click();
    await expect(page).toHaveURL(/\/recipes\/new$/);
  });
}

test("on desktop, everything is a button and there's no menu", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await logIn(page, "chef");
  await expect(menuButton(page)).toBeHidden();
  await expect(
    header(page).getByRole("link", { name: "New recipe" }),
  ).toBeVisible();
  await expect(
    header(page).getByRole("button", { name: "Log out" }),
  ).toBeVisible();
  await expect(
    header(page).getByRole("switch", { name: "Dark blue theme" }),
  ).toBeVisible();
});

test("menu items work: theme, Manage, log out", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await logIn(page, "mod");
  const html = page.locator("html");
  await expect(html).toHaveClass(/\bdark\b/);

  // Theme switches without closing the menu
  await menuButton(page).click();
  await menu(page)
    .getByRole("menuitem", { name: "Switch to light theme" })
    .click();
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(
    menu(page).getByRole("menuitem", { name: "Switch to dark blue theme" }),
  ).toBeVisible();
  await menu(page)
    .getByRole("menuitem", { name: "Switch to dark blue theme" })
    .click();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.keyboard.press("Escape");

  await menuButton(page).click();
  await menu(page).getByRole("menuitem", { name: "Manage" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await menuButton(page).click();
  await menu(page).getByRole("menuitem", { name: "Log out" }).click();
  await expect(
    header(page).getByRole("link", { name: /^Your profile/ }),
  ).toHaveCount(0);
});

test("guests log in from the menu and come back", async ({ page }) => {
  const id = await userId(email("chef"));
  await page.setViewportSize(PHONE);
  await page.goto(`/users/${id}`);
  await expect(header(page).getByRole("link", { name: "Log in" })).toBeHidden();
  await menuButton(page).click();
  await menu(page).getByRole("menuitem", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await page.getByLabel("Email").fill(email("chef"));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp(`/users/${id}$`));
});

test("'Back to top' is in the menu once scrolled", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();

  await menuButton(page).click();
  await expect(
    menu(page).getByRole("menuitem", { name: "Back to top" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.evaluate(() =>
    window.scrollTo({ top: 2000, behavior: "instant" }),
  );
  await menuButton(page).click();
  await menu(page).getByRole("menuitem", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "Browse recipes" }),
  ).toBeFocused();
});
