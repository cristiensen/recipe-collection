import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type JSHandle, type Page, test } from "@playwright/test";
import { createUser, deleteUsers } from "./db";

const run = Date.now();
const chef = { email: `dropchef-${run}@e2e.test`, password: "password-123" };
const png = readFileSync(path.join(__dirname, "fixtures/dish.png")).toString(
  "base64",
);

test.beforeAll(() => createUser(chef.email, "Drop Chef", 2, chef.password));
test.afterAll(() => deleteUsers(`%-${run}@e2e.test`));

/** A DataTransfer holding the fixture image, as the OS would provide on a file drag. */
function imageTransfer(page: Page) {
  return page.evaluateHandle((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "dish.png", { type: "image/png" }));
    return dt;
  }, png);
}

/** Dispatches a drop on the element matching `selector`; returns whether it was cancelled. */
function dropOn(page: Page, selector: string, dt: JSHandle<DataTransfer>) {
  return page.evaluate(
    ([sel, transfer]) => {
      const event = new DragEvent("drop", {
        dataTransfer: transfer,
        bubbles: true,
        cancelable: true,
      });
      document.querySelector(sel)?.dispatchEvent(event);
      return event.defaultPrevented;
    },
    [selector, dt] as const,
  );
}

test("photos can be dropped on 'Add photos', and only there", async ({
  page,
}) => {
  await page.goto("/login?callbackUrl=/recipes/new");
  await page.getByLabel("Email").fill(chef.email);
  await page.getByLabel("Password").fill(chef.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(
    page.getByRole("heading", { name: "Share a recipe" }),
  ).toBeVisible();

  const zone = page.getByTestId("image-drop-zone");
  const photos = page.getByRole("img", { name: /photo \d/ });
  const dt = await imageTransfer(page);

  // Dragging over the zone highlights it
  await zone.dispatchEvent("dragenter", { dataTransfer: dt });
  await expect(zone).toHaveAttribute("data-dragging", "true");
  await expect(zone).toContainText("Drop to add");

  // Dropping elsewhere is cancelled (so the browser won't open the file) and adds nothing
  expect(await dropOn(page, "h1", dt)).toBe(true);
  expect(await dropOn(page, "#title", dt)).toBe(true);
  await expect(photos).toHaveCount(0);

  // Dropping on the zone uploads the photo
  expect(await dropOn(page, '[data-testid="image-drop-zone"]', dt)).toBe(true);
  await expect(photos).toHaveCount(1);
  await expect(page.getByText("Cover", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(zone).not.toHaveAttribute("data-dragging");

  // Dragging text (not files) is left alone, so text drag-and-drop into inputs still works
  const textDropCancelled = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "hello");
    const event = new DragEvent("drop", {
      dataTransfer: dt,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector("h1")?.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(textDropCancelled).toBe(false);
});
