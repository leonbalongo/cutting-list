import test from "node:test";
import assert from "node:assert/strict";
import { utils, write } from "@e965/xlsx";
import {
  parseMeasurementWorkbook,
  measurementRows,
} from "../src/spreadsheet.js";
import { readFile } from "node:fs/promises";

const rows = [
  ["Cabinet measurements"],
  [],
  ["Length (mm)", "Width", "Qty", "Enabled", "Name", "Grain", "Rotate"],
  [720, 560, 2, true, "Side", "length", true],
  [100, 200, 9, false, "Disabled"],
  [864, 540, 3, true, "Shelf", "none", false],
];
for (const bookType of [
  "xlsx",
  "xls",
  "xlsm",
  "xlsb",
  "ods",
  "fods",
  "csv",
  "txt",
  "xml",
]) {
  test(`reads ${bookType} with header aliases, disabled rows, grain and numeric cells`, () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "Measurements");
    const buffer = write(book, { type: "array", bookType });
    const sheet = parseMeasurementWorkbook(buffer).sheets[0];
    assert.equal(sheet.error, undefined);
    assert.equal(sheet.parts.length, 2);
    assert.equal(sheet.quantity, 5);
    assert.equal(sheet.skipped, 1);
    assert.equal(Number(sheet.parts[0].width), 560);
    assert.equal(Number(sheet.parts[0].height), 720);
    assert.equal(sheet.parts[1].rotate, false);
    assert.equal(sheet.parts[1].grain, "none");
  });
}
test("handles original Length/Width/Qty/Enabled layout with no label column", () => {
  const sheet = measurementRows([
    ["Length", "Width", "Qty", "Enabled"],
    [484, 580, 14, 1],
    [400, 200, 24, 1],
    [1, 2, 3, 0],
  ]);
  assert.equal(sheet.parts[0].label, "Part 001");
  assert.equal(sheet.quantity, 38);
  assert.equal(sheet.skipped, 1);
});
test("all worksheets remain available and invalid sheets do not hide valid ones", () => {
  const b = utils.book_new();
  utils.book_append_sheet(
    b,
    utils.aoa_to_sheet([["Notes"], ["No dimensions here"]]),
    "Notes",
  );
  utils.book_append_sheet(b, utils.aoa_to_sheet(rows), "Parts");
  const sheets = parseMeasurementWorkbook(
    write(b, { bookType: "xlsx", type: "array" }),
  ).sheets;
  assert.match(sheets[0].error, /header/);
  assert.equal(sheets[1].quantity, 5);
});
test("rejects invalid measurement rows, duplicate headings and unsafe booleans", () => {
  assert.throws(
    () =>
      measurementRows([
        ["width", "length", "qty"],
        [10, "", 1],
      ]),
    /Row 2/,
  );
  assert.throws(
    () =>
      measurementRows([
        ["width", "length", "qty"],
        [10, 20, 1.5],
      ]),
    /whole number/,
  );
  assert.throws(
    () =>
      measurementRows([
        ["width", "length", "qty", "rotate"],
        [10, 20, 1, "maybe"],
      ]),
    /true\/false/,
  );
  assert.throws(
    () =>
      measurementRows([
        ["width", "length", "height", "qty"],
        [10, 20, 30, 1],
      ]),
    /Duplicate length/,
  );
  assert.throws(
    () =>
      measurementRows([
        ["width (cm)", "length (cm)", "qty"],
        [10, 20, 1],
      ]),
    /millimeters/,
  );
});
test("retains errors for formulas without stored results; reads cached results without executing formulas", () => {
  const b = utils.book_new(),
    s = utils.aoa_to_sheet([
      ["width", "length", "qty"],
      [10, 20, 1],
    ]);
  s.A2 = { t: "n", f: "5+5", v: 10 };
  utils.book_append_sheet(b, s, "Parts");
  let result = parseMeasurementWorkbook(
    write(b, { bookType: "xlsx", type: "array" }),
  );
  assert.equal(result.sheets[0].parts[0].width, 10);
  s.A2 = { t: "n", f: "5+5" };
  result = parseMeasurementWorkbook(
    write(b, { bookType: "xlsx", type: "array" }),
  );
  assert.match(result.sheets[0].error, /Row 2/);
});
test("UTF-16 tab-separated text imports as a worksheet", () => {
  const text = "\uFEFFLength\tWidth\tQty\n720\t560\t2";
  const bytes = Buffer.from(text, "utf16le");
  assert.equal(parseMeasurementWorkbook(bytes).sheets[0].quantity, 2);
});
