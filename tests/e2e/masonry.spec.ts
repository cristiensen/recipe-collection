import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const chef = `masonry-${run}@e2e.test`;
const LABELS = [
  "vegan",
  "vegetarian",
  "gluten-free",
  "dairy-free",
  "spicy",
  "dessert",
];
const titles: string[] = [];

// Cards of clearly different heights: short/long titles and 0–6 labels
test.beforeAll(async () => {
  await createUser(chef, "Masonry Chef", 2, "password-123");
  // Oldest, so it's in the second batch: guarantees a "Load more" button
  await insertRecipe(chef, `E2E Masonry ${run} filler`);
  for (let i = 11; i >= 0; i--) {
    const title =
      i % 3 === 0
        ? `E2E Masonry ${run} #${i} with a really long title that wraps onto several lines`
        : `E2E Masonry ${run} #${i}`;
    titles.unshift(title); // inserted oldest first, so #0 is the newest
    await insertRecipe(chef, title, { labels: LABELS.slice(0, (i * 5) % 7) });
  }
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

type Box = {
  x: number;
  y: number;
  right: number;
  bottom: number;
  title: string;
};

/** Positions of the first 12 cards on the page, in DOM order. */
async function cardBoxes(page: Page): Promise<Box[]> {
  return page.locator("ul[data-masonry='on'] > li article").evaluateAll((els) =>
    els.slice(0, 12).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: r.y + window.scrollY,
        right: r.right,
        bottom: r.bottom + window.scrollY,
        title: el.querySelector("h2")?.textContent ?? "",
      };
    }),
  );
}

function columns(boxes: Box[]) {
  const byX = new Map<number, Box[]>();
  for (const b of boxes) byX.set(b.x, [...(byX.get(b.x) ?? []), b]);
  return [...byX.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, col]) => col.sort((a, b) => a.y - b.y));
}

for (const { name, width, cols } of [
  { name: "desktop", width: 1280, cols: 3 },
  { name: "phone", width: 390, cols: 1 },
]) {
  test(`cards are equally spaced (${name})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
    const boxes = await cardBoxes(page);
    expect(boxes.map((b) => b.title)).toEqual(titles); // newest first, in order

    const grid = columns(boxes);
    expect(grid).toHaveLength(cols);
    // Vertical: 16px between a card and the one below it, in every column
    for (const col of grid) {
      for (let i = 1; i < col.length; i++) {
        const gap = col[i].y - col[i - 1].bottom;
        expect(gap).toBeGreaterThanOrEqual(15.5);
        expect(gap).toBeLessThan(17.5);
      }
    }
    // Horizontal: 16px between neighbouring columns
    for (let c = 1; c < grid.length; c++) {
      expect(grid[c][0].x - grid[c - 1][0].right).toBeCloseTo(16, 0);
    }
    if (cols > 1) {
      // The first row keeps reading order, and heights really differ (masonry, not rows)
      expect(boxes.slice(0, cols).map((b) => b.x)).toEqual(
        grid.map((col) => col[0].x),
      );
      const heights = new Set(boxes.map((b) => Math.round(b.bottom - b.y)));
      expect(heights.size).toBeGreaterThan(1);
    }
  });
}

test("'Load more' doesn't move the cards already shown", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  const before = await cardBoxes(page);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.locator("ul > li article")).not.toHaveCount(12);
  await expect(page.locator("ul[data-masonry='on']")).toBeVisible();
  expect(await cardBoxes(page)).toEqual(before);
});
