import { expect, type Page, test } from "@playwright/test";
import {
  createUser,
  deleteOrphanResetTokens,
  deleteUsers,
  insertResetToken,
} from "./db";

const run = Date.now();
const email = `reset-${run}@e2e.test`;
const name = `Reset User ${run}`;
const oldPassword = "old-password-123";
const newPassword = "new-password-456";
const token = `e2e-token-${run}`;

test.beforeAll(() => createUser(email, name, 1, oldPassword));
test.afterAll(async () => {
  await deleteUsers(`%-${run}@e2e.test`);
  await deleteOrphanResetTokens();
});

async function logIn(page: Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("forgot password answers the same for any email", async ({ page }) => {
  for (const address of [email, `nobody-${run}@e2e.test`]) {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await page.getByLabel("Email").fill(address);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(
      page.getByText(`If an account exists for ${address}`),
    ).toBeVisible();
  }
});

test("a reset link sets a new password once and signs out other sessions", async ({
  page,
  browser,
}) => {
  // Another device that logged in before the reset
  const other = await browser.newPage();
  await logIn(other, oldPassword);
  await expect(other.getByTestId("header-user-name")).toHaveText(name);

  await insertResetToken(email, token);
  await page.goto(`/reset-password?token=${token}`);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill("something-else");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("Passwords don't match")).toBeVisible();

  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByTestId("header-user-name")).toHaveText(name);

  // The other device is logged out
  await other.reload();
  await expect(
    other.getByRole("link", { name: "Log in", exact: true }),
  ).toBeVisible();
  await other.close();

  // The link works only once
  await page.goto(`/reset-password?token=${token}`);
  await expect(page.getByText("This reset link has expired")).toBeVisible();

  // Only the new password logs in
  await page.getByRole("button", { name: "Log out" }).click();
  await logIn(page, oldPassword);
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await logIn(page, newPassword);
  await expect(page.getByTestId("header-user-name")).toHaveText(name);
});

test("an unknown token shows how to get a new link", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token");
  await expect(page.getByText("This reset link has expired")).toBeVisible();
  await page.getByRole("link", { name: "Request a new link" }).click();
  await expect(
    page.getByRole("heading", { name: "Forgot password" }),
  ).toBeVisible();
});
