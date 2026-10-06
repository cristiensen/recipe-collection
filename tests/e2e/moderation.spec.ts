import { type Browser, expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe, insertReview } from "./db";

const run = Date.now();
const password = "password-123";
const who = (role: string) => ({
  name: `${role} ${run}`,
  email: `${role}-${run}@e2e.test`,
});
const user = who("user");
const chef = who("chef");
const mod = who("mod");
const admin = who("admin");
const title = `E2E Moderated Soup ${run}`;
let recipeUrl = "";

test.beforeAll(async () => {
  await createUser(user.email, user.name, 1, password);
  await createUser(chef.email, chef.name, 2, password);
  await createUser(mod.email, mod.name, 10, password);
  await createUser(admin.email, admin.name, 100, password);
  const recipeId = await insertRecipe(chef.email, title);
  await insertReview(recipeId, user.email, 1, "Spam spam spam");
  await insertReview(recipeId, admin.email, 5, "Admin says it's great");
  recipeUrl = `/recipes/${recipeId}`;
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

async function logInAs(
  browser: Browser,
  account: { email: string },
  to: string,
) {
  const page = await browser.newPage();
  await page.goto(`/login?callbackUrl=${encodeURIComponent(to)}`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  return page;
}

const reviewBy = (page: Page, name: string) =>
  page
    .getByTestId("review-list")
    .getByRole("listitem")
    .filter({ hasText: name });

test("level 1 users can review but not publish or manage", async ({
  browser,
}) => {
  const page = await logInAs(browser, user, "/");
  await expect(page.getByRole("link", { name: "New recipe" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Manage" })).toHaveCount(0);

  await page.goto("/recipes/new");
  await expect(
    page.getByRole("heading", { name: "Only chefs can publish recipes" }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: /don't have access/ }),
  ).toBeVisible();

  await page.goto(recipeUrl);
  await expect(
    page.getByRole("button", { name: "Update review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Moderate review/ }),
  ).toHaveCount(0);
  await page.context().close();
});

test("moderators edit, ban and remove; admins manage accounts", async ({
  browser,
}) => {
  // Moderator: tools on the user's review, none on the admin's
  const modPage = await logInAs(browser, mod, recipeUrl);
  await expect(modPage.getByRole("link", { name: "Manage" })).toBeVisible();
  await expect(
    reviewBy(modPage, admin.name).getByRole("button", {
      name: /^Moderate review/,
    }),
  ).toHaveCount(0);

  const spam = reviewBy(modPage, user.name);
  await spam
    .getByRole("button", { name: `Moderate review by ${user.name}` })
    .click();
  await modPage.getByRole("menuitem", { name: "Edit comment" }).click();
  await modPage
    .getByRole("dialog")
    .getByLabel("Comment")
    .fill("[removed by moderator: spam]");
  await modPage.getByRole("button", { name: "Save comment" }).click();
  await expect(spam).toContainText("[removed by moderator: spam]");
  await expect(spam).toContainText("edited by a moderator");

  await spam
    .getByRole("button", { name: `Moderate review by ${user.name}` })
    .click();
  await modPage.getByRole("menuitem", { name: "Ban reviewer" }).click();
  await expect(modPage.getByText(`${user.name} was banned`)).toBeVisible();

  // The banned user is read-only
  const userPage = await logInAs(browser, user, recipeUrl);
  await expect(
    userPage.getByText(/suspended and is read-only/).first(),
  ).toBeVisible();
  await expect(
    userPage.getByRole("button", { name: "Update review" }),
  ).toHaveCount(0);
  await expect(
    reviewBy(userPage, admin.name).getByRole("button", { name: /^Like/ }),
  ).toBeDisabled();

  // Removing the review deletes its rating too: 1★ + 5★ → only 5★ remains
  await expect(modPage.getByTestId("rating-summary")).toHaveText(
    "3.0 from 2 ratings",
  );
  await spam
    .getByRole("button", { name: `Moderate review by ${user.name}` })
    .click();
  await modPage.getByRole("menuitem", { name: "Remove review" }).click();
  await modPage.getByRole("button", { name: "Remove review" }).click();
  await expect(reviewBy(modPage, user.name)).toHaveCount(0);
  await expect(modPage.getByTestId("rating-summary")).toHaveText(
    "5.0 from 1 rating",
  );

  // Moderators see ban controls but not level or delete controls
  await modPage.goto("/admin");
  const modRow = modPage.getByTestId(`user-row-${user.email}`);
  await expect(modRow.getByRole("button", { name: "Unban" })).toBeVisible();
  await expect(modRow.getByRole("combobox")).toHaveCount(0);
  await expect(modRow.getByRole("button", { name: "Delete" })).toHaveCount(0);

  // Admin: promote, unban, and delete accounts; no controls on their own row
  const adminPage = await logInAs(browser, admin, "/admin");
  await adminPage.getByLabel("Search users").fill(`-${run}@e2e.test`);
  await adminPage.getByRole("button", { name: "Search" }).click();
  await expect(adminPage.getByText("4 accounts")).toBeVisible();
  await expect(
    adminPage.getByTestId(`user-row-${admin.email}`).getByRole("button"),
  ).toHaveCount(0);

  const row = adminPage.getByTestId(`user-row-${user.email}`);
  await row.getByRole("button", { name: "Unban" }).click();
  await expect(row.getByRole("button", { name: "Ban" })).toBeVisible();
  await row.getByLabel(`Privilege level for ${user.name}`).selectOption("2");
  await expect(adminPage.getByText(`${user.name} is now chef`)).toBeVisible();

  // The promotion applies on the user's next request
  await userPage.goto("/");
  await expect(
    userPage.getByRole("link", { name: "New recipe" }),
  ).toBeVisible();

  // Deleting the chef's account removes their recipe as well
  const chefRow = adminPage.getByTestId(`user-row-${chef.email}`);
  await chefRow.getByRole("button", { name: "Delete" }).click();
  await adminPage.getByRole("button", { name: "Delete account" }).click();
  await expect(chefRow).toHaveCount(0);
  expect((await adminPage.goto(recipeUrl))?.status()).toBe(404);

  await Promise.all(browser.contexts().map((c) => c.close()));
});
