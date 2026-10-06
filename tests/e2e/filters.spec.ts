import { expect, test } from "@playwright/test";

test("label filters: 5 chips, then a searchable 'See all filters' dropdown", async ({
  page,
}) => {
  await page.goto("/");
  const filters = page.getByRole("region", { name: "Filter recipes" });
  const chips = filters.getByRole("checkbox");

  await expect(chips).toHaveCount(5);
  await expect(filters.getByText("Breakfast", { exact: true })).toHaveCount(0);

  await filters.getByRole("button", { name: "See all filters" }).click();
  const search = page.getByRole("combobox", { name: "Search labels" });
  await expect(search).toBeFocused();
  const list = page.getByRole("listbox", { name: "All labels" });
  await expect(list.getByRole("option")).toHaveCount(8);

  // Searching narrows the list
  await search.fill("break");
  await expect(list.getByRole("option")).toHaveCount(1);
  await list.getByRole("option", { name: "Breakfast" }).click();

  // The filter applies, the dropdown stays open, and the label appears as a chip
  await expect(page).toHaveURL(/labels=breakfast/);
  await expect(list).toBeVisible();
  await expect(list.getByRole("option", { name: "Breakfast" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(chips).toHaveCount(6);
  await expect(
    filters.getByRole("checkbox", { name: "Breakfast" }),
  ).toBeChecked();

  // No matches
  await filters.getByRole("button", { name: "See all filters" }).click();
  await page.getByRole("combobox", { name: "Search labels" }).fill("zzz");
  await expect(page.getByText("No labels found.")).toBeVisible();
  await page.keyboard.press("Escape");

  // Clearing removes the extra chip and resets the URL
  await filters.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(chips).toHaveCount(5);
});
