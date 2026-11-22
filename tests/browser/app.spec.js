import { test, expect } from "@playwright/test";
import { utils, write } from "@e965/xlsx";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";

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
  await page.getByRole("button", { name: "Import spreadsheet" }).click();
  const pickerOpened = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose spreadsheet", exact: true })
    .click();
  const picker = await pickerOpened;
  expect(
    await picker
      .element()
      .evaluate((input) => Boolean(input.closest("dialog[open]"))),
  ).toBe(true);
  await expect(page.locator("#file-input")).toHaveAttribute("accept", "");
  await picker.setFiles({
    name: "parts.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "label,width,length,quantity,material,rotate\nLarge panel,9999,9999,1,Plywood,false\nSmall shelf,100,200,2,Plywood,true",
    ),
  });
  await page.getByRole("button", { name: "Import parts", exact: true }).click();
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

test("mobile picker accepts CSV with a generic provider MIME type and no extension", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .click();
  const opened = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose spreadsheet", exact: true })
    .click();
  const chooser = await opened;
  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles({
    name: "document",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(
      "label,width,length,quantity\nProvider shelf,100,200,2",
    ),
  });
  await page.getByRole("button", { name: "Import parts", exact: true }).click();
  await expect(page.getByLabel("Part 1 label")).toHaveValue("Provider shelf");
  await expect(page.locator(".part-row")).toHaveCount(1);
});

test("cancel and failed imports retain the cut list and allow picking the same file again", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .click();
  let opened = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose spreadsheet", exact: true })
    .click();
  await (await opened).setFiles([]);
  await expect(page.locator(".part-row")).toHaveCount(5);
  const file = {
    name: "cutting_list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([0x50, 0x4b, 3, 4]),
  };
  for (let i = 0; i < 2; i++) {
    opened = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Choose spreadsheet", exact: true })
      .click();
    await (await opened).setFiles(file);
    await expect(page.getByRole("alert")).toContainText(
      "Cannot read this spreadsheet",
    );
    await expect(page.locator(".part-row")).toHaveCount(5);
    await expect(page.getByLabel("Side panel width")).toHaveValue("720");
  }
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .click();
  opened = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose spreadsheet", exact: true })
    .click();
  expect(
    await (
      await opened
    )
      .element()
      .evaluate((input) => input.closest("dialog")?.open),
  ).toBe(true);
});

test("project JSON picker opens inside My projects and uses the selected import mode", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  const project = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cutcraft-draft-v1")),
  );
  project.name = "Restored Android project";
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  const opened = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open project JSON", exact: true })
    .click();
  const chooser = await opened;
  expect(
    await chooser.element().evaluate((input) => input.closest("dialog")?.open),
  ).toBe(true);
  await chooser.setFiles({
    name: "backup",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Restored Android project",
  );
  await expect(page.locator(".part-row")).toHaveCount(5);
});

test("grain consideration exposes part/stock axes and persists them", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Consider grain direction", exact: true })
    .check();
  await page
    .getByLabel("Side panel grain direction", { exact: true })
    .selectOption("width");
  await page
    .getByLabel("Adjustable shelf grain direction", { exact: true })
    .selectOption("none");
  await page
    .getByLabel("Standard sheet grain direction", { exact: true })
    .selectOption("length");
  await page.reload();
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Consider grain direction",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Side panel grain direction", { exact: true }),
  ).toHaveValue("width");
  await expect(
    page.getByLabel("Adjustable shelf grain direction", { exact: true }),
  ).toHaveValue("none");
  await expect(page.locator(".sheet-svg")).toContainText("Grain along length");
});

test("Excel import previews worksheets and only applies the selected measurement sheet", async ({
  page,
}) => {
  const book = utils.book_new();
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([["Notes"], ["Not measurement data"]]),
    "Notes",
  );
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ["Length", "Width", "Qty", "Enabled"],
      [720, 560, 2, 1],
      [864, 540, 3, 1],
      [10, 10, 99, 0],
    ]),
    "Cabinet",
  );
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .click();
  const opened = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose spreadsheet", exact: true })
    .click();
  await (
    await opened
  ).setFiles({
    name: "measurements.xlsx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(write(book, { type: "array", bookType: "xlsx" })),
  });
  await expect(page.locator("#import-preview")).toContainText(
    "2 rows · 5 pieces",
  );
  await expect(page.locator(".part-row")).toHaveCount(5);
  await page.getByLabel("Worksheet", { exact: true }).selectOption("0");
  await expect(
    page.getByRole("button", { name: "Import parts", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Worksheet", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Import parts", exact: true }).click();
  await expect(page.locator(".part-row")).toHaveCount(2);
  await expect(page.getByLabel("Part 001 width", { exact: true })).toHaveValue(
    "560",
  );
  await expect(page.getByLabel("Part 001 length", { exact: true })).toHaveValue(
    "720",
  );
});

test("complete PDF download includes every sheet and statistics", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  const count = await page.locator(".sheet-tab").count();
  await page.getByRole("button", { name: "Export plan" }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Complete PDF report/ }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toContain("-cutting-report.pdf");
  const pdf = await PDFDocument.load(await readFile(await download.path()));
  expect(pdf.getPageCount()).toBe(count + 2);
  expect(pdf.getSubject()).toContain("statistics");
});

test("spreadsheet import and complete PDF export work without a network connection", async ({
  page,
  context,
}) => {
  test.skip(!process.env.TEST_PRODUCTION, "Requires production offline cache.");
  await page.goto("/");
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .click();
  const opened = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose spreadsheet", exact: true })
    .click();
  await (
    await opened
  ).setFiles({
    name: "offline.tsv",
    mimeType: "text/plain",
    buffer: Buffer.from("Length\tWidth\tQty\n600\t400\t2"),
  });
  await page.getByRole("button", { name: "Import parts", exact: true }).click();
  await page.locator("#optimize-button").click();
  await expect(page.getByText("Layout ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Export plan" }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Complete PDF report/ }).click();
  const file = await pending;
  const pdf = await PDFDocument.load(await readFile(await file.path()));
  expect(pdf.getPageCount()).toBe(3);
});
