import test from "node:test";
import assert from "node:assert/strict";
import { parseCSV, partsFromCSV, csvCell } from "../src/csv.js";
test("handles BOM, CRLF, quoted commas, multiline fields and escaped quotes", () => {
  assert.deepEqual(
    parseCSV('\uFEFFlabel,width\r\n"A, B",20\r\n"A ""quote""\nline",30\r\n'),
    [
      ["label", "width"],
      ["A, B", "20"],
      ['A "quote"\nline', "30"],
    ],
  );
});
test("imports required headers and optional rotation/material", () => {
  const p = partsFromCSV(
    "label,width,length,quantity,rotate\nSide,20,30,2,false\nShelf,40,50,1,true",
  );
  assert.equal(p.length, 2);
  assert.equal(p[0].rotate, false);
  assert.equal(p[1].material, "Plywood");
  assert.notEqual(p[0].id, p[1].id);
});
test("invalid CSV gives actionable errors", () => {
  assert.throws(() => parseCSV('"bad'), /unclosed quote/);
  assert.throws(
    () => partsFromCSV("label,width\nA,20"),
    /Missing CSV column: length/,
  );
  assert.throws(() => partsFromCSV(""), /header/);
});
test("CSV escaped cells round trip", () => {
  const row = ["A, B", 'a"b', "line\nbreak", ""];
  assert.deepEqual(parseCSV(row.map(csvCell).join(",")), [row]);
});
