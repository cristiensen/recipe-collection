import { expect, type Page, test } from "@playwright/test";
import {
  createUser,
  deleteLabels,
  deleteUsers,
  fillLabels,
  insertRecipe,
  setLabelCreatedAt,
  userId,
} from "./db";

const run = Date.now();
const password = "password-123";
const chef = `labels-chef-${run}@e2e.test`;
const admin = `labels-admin-${run}@e2e.test`;
const user = `labels-user-${run}@e2e.test`;
// Names unique to this run
const fromFilters = `E2E Filters ${run}`;
const fromSettings = `E2E Settings ${run}`;
const old = `E2E Old ${run}`;
const slug = (name: string) => name.toLowerCase().replaceAll(" ", "-");

test.beforeAll(async () => {
  await createUser(chef, "Labels Chef", 2, password);
  await createUser(admin, "Labels Admin", 100, password);
  await createUser(user, "Labels User", 1, password);
});
test.afterAll(async () => {
  // Labels outlive their creators, so remove them explicitly
  await deleteLabels([fromFilters, fromSettings, old].map(slug));
  await deleteUsers(`%-${run}@e2e.test`);
});

async function logIn(page: Page, email: string, to: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(to)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

const labelsSection = (page: Page) =>
  page.locator("section", {
    has: page.getByRole("heading", { name: "Labels", exact: true }),
  });

test("users can't create labels", async ({ page }) => {
  await logIn(page, user, "/");
  const filters = page.getByRole("region", { name: "Filter recipes" });
  await expect(filters.getByRole("checkbox").first()).toBeVisible();
  await expect(filters.getByRole("button", { name: "New label" })).toHaveCount(
    0,
  );
});

test("chefs create labels from the filters", async ({ page }) => {
  await logIn(page, chef, "/");
  const filters = page.getByRole("region", { name: "Filter recipes" });

  // From the filters
  await filters.getByRole("button", { name: "New label" }).click();
  await page.getByLabel("New label").fill(fromFilters);
  await page.getByRole("button", { name: "Add label" }).click();
  await expect(page.getByText(`Label “${fromFilters}” created`)).toBeVisible();
  await filters.getByRole("button", { name: "See all filters" }).click();
  await expect(
    page
      .getByRole("listbox", { name: "All labels" })
      .getByRole("option", { name: fromFilters }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // The same name again (in any case) is refused
  await filters.getByRole("button", { name: "New label" }).click();
  await page.getByLabel("New label").fill(fromFilters.toUpperCase());
  await page.getByRole("button", { name: "Add label" }).click();
  await expect(
    page.getByText(`There's already a label called “${fromFilters}”`),
  ).toBeVisible();
});

test("the labels settings: create, delete within 15 minutes, then not any more", async ({
  page,
}) => {
  await logIn(page, chef, `/users/${await userId(chef)}?tab=settings`);
  const section = labelsSection(page);
  await expect(
    section.getByText("You can delete a label within 15 minutes"),
  ).toBeVisible();

  for (const name of [fromSettings, old]) {
    await section.getByLabel("New label").fill(name);
    await section.getByRole("button", { name: "Add label" }).click();
    await expect(section.getByText(name, { exact: true })).toBeVisible();
  }
  // The label made from the filters is listed too
  await expect(section.getByText(fromFilters, { exact: true })).toBeVisible();

  // Fresh labels can be deleted
  await section
    .getByRole("button", { name: `Delete label ${fromSettings}` })
    .click();
  await page.getByRole("button", { name: "Delete label" }).click();
  await expect(page.getByText(`Label “${fromSettings}” deleted`)).toBeVisible();
  await expect(section.getByText(fromSettings, { exact: true })).toHaveCount(0);

  // After 15 minutes, only admins can
  await setLabelCreatedAt(slug(old), 16);
  await page.reload();
  await expect(section.getByText(old, { exact: true })).toBeVisible();
  await expect(
    section.getByRole("button", { name: `Delete label ${old}` }),
  ).toHaveCount(0);
  await expect(section.getByText(/can no longer be deleted/)).toBeVisible();
});

test("admins can delete any label; it's removed from recipes", async ({
  page,
}) => {
  const recipe = await insertRecipe(chef, `E2E Labelled ${run}`, {
    imageUrls: ["/api/uploads/e2e-labels.png"],
    labels: ["vegan", slug(old)],
  });

  await logIn(page, admin, `/recipes/${recipe}`);
  await expect(page.locator("header").getByText(old)).toBeVisible();

  await page.goto(`/users/${await userId(admin)}?tab=settings`);
  const section = labelsSection(page);
  await expect(section.getByText("As an admin")).toBeVisible();
  await expect(section.getByText("All labels")).toBeVisible();
  // Built-in labels are deletable by admins too (the oldest needs a search)
  const search = section.getByRole("searchbox", { name: "Search labels" });
  await search.fill("Vegan");
  await expect(
    section.getByRole("button", { name: "Delete label Vegan" }),
  ).toBeVisible();
  await search.fill(old);

  await section.getByRole("button", { name: `Delete label ${old}` }).click();
  await expect(
    page.getByText("It will be removed from the recipe that uses it."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete label" }).click();
  await expect(page.getByText(`Label “${old}” deleted`)).toBeVisible();
  await expect(section.getByText(old, { exact: true })).toHaveCount(0);

  await page.goto(`/recipes/${recipe}`);
  await expect(
    page.locator("header").getByText("Vegan", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("header").getByText(old)).toHaveCount(0);
});

test("there can be at most 100 labels", async ({ page }) => {
  await logIn(page, chef, "/");
  const filters = page.getByRole("region", { name: "Filter recipes" });
  // Opened before the limit is reached...
  await filters.getByRole("button", { name: "New label" }).click();
  const added = await fillLabels(100, `e2e-fill-${run}`);
  try {
    // ...the server still refuses
    await page.getByLabel("New label").fill(`E2E Too Many ${run}`);
    await page.getByRole("button", { name: "Add label" }).click();
    await expect(
      page.getByText("There can be at most 100 labels."),
    ).toBeVisible();

    // Once full, there's no form to add one
    await page.goto("/");
    await expect(filters.getByRole("checkbox").first()).toBeVisible();
    await expect(
      filters.getByRole("button", { name: "New label" }),
    ).toHaveCount(0);
    await page.goto(`/users/${await userId(chef)}?tab=settings`);
    const section = labelsSection(page);
    await expect(section.getByText("100 of 100 labels in use.")).toBeVisible();
    await expect(section.getByLabel("New label")).toHaveCount(0);
    await expect(section.getByText("The label limit is reached")).toBeVisible();
  } finally {
    await deleteLabels(added);
  }
});

test("Settings lists 8 labels at a time, and search finds the rest", async ({
  page,
}) => {
  await logIn(page, admin, `/users/${await userId(admin)}?tab=settings`);
  // Admins list every label: the 8 built-in ones plus these (newest first)
  const extra = Array.from({ length: 4 }, (_, i) => `E2E List ${run} ${i}`);
  const section = labelsSection(page);
  try {
    for (const name of extra) {
      await section.getByLabel("New label").fill(name);
      await section.getByRole("button", { name: "Add label" }).click();
      await expect(page.getByText(`Label “${name}” created`)).toBeVisible();
    }
    const rows = section.getByRole("listitem");
    await expect(rows).toHaveCount(8);
    await expect(section.getByText(/^Showing 8 of \d+ labels\./)).toBeVisible();
    // The oldest labels aren't listed until searched for
    await expect(section.getByText("Vegan", { exact: true })).toHaveCount(0);

    const search = section.getByRole("searchbox", { name: "Search labels" });
    await search.fill("VEG");
    await expect(rows).toHaveCount(2);
    await expect(section.getByText("Vegan", { exact: true })).toBeVisible();
    await expect(
      section.getByText("Vegetarian", { exact: true }),
    ).toBeVisible();
    await expect(section.getByText(/^Showing/)).toHaveCount(0);

    await search.fill(`list ${run}`);
    await expect(rows).toHaveCount(4);

    await search.fill("zzz-nothing");
    await expect(
      section.getByText("No labels match “zzz-nothing”."),
    ).toBeVisible();
  } finally {
    await deleteLabels(extra.map(slug));
  }
});
