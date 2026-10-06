import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const chef = `gallerychef-${run}@e2e.test`;
const images = [
  "/api/uploads/e2e-cover.png",
  "/api/uploads/e2e-second.png",
  "/api/uploads/e2e-third.png",
];
let withVideo = "";
let withoutVideo = "";

test.beforeAll(async () => {
  await createUser(chef, "Gallery Chef", 2, "password-123");
  withVideo = await insertRecipe(chef, `E2E Video Recipe ${run}`, {
    imageUrls: images,
    videoUrl: "/api/uploads/e2e-clip.mp4",
  });
  withoutVideo = await insertRecipe(chef, `E2E Photo Recipe ${run}`, {
    imageUrls: images,
  });
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

/** Rendered sizes of the gallery's photos, in page order. */
async function photoSizes(page: Page) {
  const boxes = await page.locator("article img").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height) };
    }),
  );
  return boxes;
}

/** Tag names of the gallery's media, in page order. */
function mediaOrder(page: Page) {
  return page
    .locator("article video, article img")
    .evaluateAll((els) => els.map((el) => el.tagName.toLowerCase()));
}

test("a recipe's video comes first, with its photos below", async ({
  page,
}) => {
  await page.goto(`/recipes/${withVideo}`);
  await expect(page.locator("article video")).toHaveCount(1);
  expect(await mediaOrder(page)).toEqual(["video", "img", "img", "img"]);
  // The video sits above the photos visually too
  const video = await page.locator("article video").boundingBox();
  const cover = await page
    .getByRole("img", { name: `E2E Video Recipe ${run}`, exact: true })
    .boundingBox();
  expect(video && cover && video.y < cover.y).toBe(true);

  // With a video, every photo is the same size
  const sizes = await photoSizes(page);
  expect(sizes).toHaveLength(3);
  for (const size of sizes) expect(size).toEqual(sizes[0]);
});

test("without a video, the photos come first", async ({ page }) => {
  await page.goto(`/recipes/${withoutVideo}`);
  await expect(page.locator("article video")).toHaveCount(0);
  expect(await mediaOrder(page)).toEqual(["img", "img", "img"]);

  // Without a video, the cover is shown larger than the other photos
  const [cover, second, third] = await photoSizes(page);
  expect(cover.width).toBeGreaterThan(second.width);
  expect(second).toEqual(third);
});
