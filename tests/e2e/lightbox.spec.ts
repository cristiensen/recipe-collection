import { expect, type Page, test } from "@playwright/test";
import { createUser, deleteUsers, insertRecipe } from "./db";

const run = Date.now();
const chef = `lightboxchef-${run}@e2e.test`;
let recipeUrl = "";

test.beforeAll(async () => {
  await createUser(chef, "Lightbox Chef", 2, "password-123");
  const id = await insertRecipe(chef, `E2E Lightbox ${run}`, {
    imageUrls: [
      "/api/uploads/lb-1.png",
      "/api/uploads/lb-2.png",
      "/api/uploads/lb-3.png",
    ],
  });
  recipeUrl = `/recipes/${id}`;
});
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

const track = (page: Page) => page.getByTestId("lightbox-track");
const counter = (page: Page) =>
  page.getByRole("dialog").getByText(/^Photo \d of 3$/);

/** The track's horizontal offset in slides (0 = first photo). */
const slideOffset = (page: Page) =>
  track(page).evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return Math.round(-m.m41 / el.getBoundingClientRect().width);
  });

test("clicking a photo opens a viewer with arrow navigation", async ({
  page,
}) => {
  await page.goto(recipeUrl);
  const second = page.getByRole("button", { name: "Enlarge photo 2 of 3" });
  await second.click();

  const dialog = page.getByRole("dialog", {
    name: `E2E Lightbox ${run} — photos`,
  });
  await expect(dialog).toBeVisible();
  await expect(counter(page)).toHaveText("Photo 2 of 3");
  await expect.poll(() => slideOffset(page)).toBe(1);

  // Smooth sliding transition between photos
  await expect(track(page)).toHaveCSS("transition-property", /\btransform\b/);
  await expect(track(page)).toHaveCSS("transition-duration", "0.3s");

  // Keyboard
  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("Photo 3 of 3");
  await expect.poll(() => slideOffset(page)).toBe(2);
  await expect(
    dialog.getByRole("button", { name: "Next photo" }),
  ).toBeDisabled();
  await page.keyboard.press("ArrowRight"); // stays on the last photo
  await expect(counter(page)).toHaveText("Photo 3 of 3");

  // Buttons
  await dialog.getByRole("button", { name: "Previous photo" }).click();
  await dialog.getByRole("button", { name: "Previous photo" }).click();
  await expect(counter(page)).toHaveText("Photo 1 of 3");
  await expect(
    dialog.getByRole("button", { name: "Previous photo" }),
  ).toBeDisabled();

  // Swipe left on touch screens goes to the next photo
  // The viewport around the track (the track itself moves while sliding)
  const box = await track(page).locator("..").boundingBox();
  if (!box) throw new Error("track not visible");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y);
  await page.mouse.up();
  await expect(counter(page)).toHaveText("Photo 2 of 3");

  // Escape closes and returns focus to the photo that was clicked
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(second).toBeFocused();
});

test("the slide animation is off for users who prefer reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(recipeUrl);
  await page.getByRole("button", { name: "Enlarge photo 1 of 3" }).click();
  await expect(track(page)).toHaveCSS("transition-property", "none");
});
