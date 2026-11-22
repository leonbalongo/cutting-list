import { test, expect } from "@playwright/test";

test("loads and optimizes the demo without browser errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await expect(page.locator(".sheet-svg")).toBeVisible();
  await expect(page.getByText("Every piece has its place")).toBeVisible();
  await page.locator('.sheet-svg g[role="button"]').first().click();
  await expect(page.locator(".part-inspector")).toBeVisible();
  await page.getByRole("button", { name: "Cut list", exact: true }).click();
  await expect(page.locator(".cutlist-table tbody tr").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/cutcraft-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("editing invalidates results, validates and persists locally", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page.getByLabel("Side panel width").fill("0");
  await expect(page.getByText("A place for every piece.")).toBeVisible();
  await page.locator("#optimize-button").click();
  await expect(page.getByText("Let’s check your cut list")).toBeVisible();
  await page.getByLabel("Side panel width").fill("720");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("My test cabinet");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "My test cabinet",
  );
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await expect(page.locator(".saved-project")).toContainText("My test cabinet");
});

test("adds and deletes parts and stock", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(page.locator(".part-row")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Delete Part 6", exact: true })
    .click();
  await expect(page.locator(".part-row")).toHaveCount(5);
  await page.getByRole("button", { name: "Add sheet", exact: true }).click();
  await expect(page.locator(".stock-table tbody tr")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Delete Stock sheet", exact: true })
    .click();
  await expect(page.locator(".stock-table tbody tr")).toHaveCount(1);
});

test("exports project, parts, diagrams and coordinates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Export plan" }).click();
  for (const [name, extension] of [
    ["Project backup", ".json"],
    ["Parts list", ".csv"],
    ["Current sheet diagram", ".svg"],
    ["Placement coordinates", ".csv"],
  ]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toContain(extension);
    expect(await download.failure()).toBeNull();
  }
});

test("imports a CSV and reports parts that cannot fit", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.locator("#file-input").setInputFiles({
    name: "parts.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "label,width,length,quantity,material,rotate\nLarge panel,9999,9999,1,Plywood,false\nSmall shelf,100,200,2,Plywood,true",
    ),
  });
  await expect(page.locator(".part-row")).toHaveCount(2);
  await page.locator("#optimize-button").click();
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await expect(page.locator(".warning")).toContainText("1 part unplaced");
  await page.getByRole("button", { name: "View parts" }).click();
  await expect(page.locator(".unplaced-list")).toContainText("Large panel");
});

test("mobile layout has no page overflow and keeps controls usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Enlarge cutting layout" }).click();
  await expect(page.locator("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.screenshot({ path: "/tmp/cutcraft-mobile.png", fullPage: true });
});

test("production app optimizes with the network disconnected", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.TEST_PRODUCTION,
    "Requires a production build with service worker.",
  );
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  ).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page.getByLabel("Side panel width").fill("710");
  await page.locator("#optimize-button").click();
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await expect(page.getByText("Every piece has its place")).toBeVisible();
});
