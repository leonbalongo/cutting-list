import test from "node:test";
import assert from "node:assert/strict";
import { readImportText } from "../src/import-file.js";
import { partsFromCSV } from "../src/csv.js";

const csv = "label,width,length,quantity\nShelf,400,600,2\n";

test("valid CSV is accepted even with generic MIME types or a missing extension", async () => {
  for (const type of [
    "text/csv",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
    "application/octet-stream",
    "",
  ]) {
    const text = await readImportText(new File([csv], "document", { type }));
    assert.equal(partsFromCSV(text)[0].label, "Shelf");
  }
});

test("accepts UTF-8 BOMs for both CSV and project JSON", async () => {
  assert.equal(
    await readImportText(new File(["\uFEFF" + csv], "parts.csv")),
    csv,
  );
  assert.deepEqual(
    JSON.parse(
      await readImportText(new File(['\uFEFF{"name":"Cabinet"}'], "backup")),
    ),
    { name: "Cabinet" },
  );
});

test("explains Excel/ZIP content disguised as CSV without altering the file", async () => {
  for (const bytes of [
    [0x50, 0x4b, 3, 4],
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  ]) {
    const file = new File([new Uint8Array(bytes)], "cutting_list.csv", {
      type: "text/csv",
    });
    await assert.rejects(
      () => readImportText(file),
      /changing the filename to .csv does not convert it/,
    );
    assert.equal(file.size, bytes.length);
  }
});

test("reports unsupported UTF-16 rather than producing misleading CSV header errors", async () => {
  for (const bytes of [
    [0xff, 0xfe, 0x6c, 0],
    [0xfe, 0xff, 0, 0x6c],
  ]) {
    await assert.rejects(
      () => readImportText(new File([new Uint8Array(bytes)], "parts.csv")),
      /CSV UTF-8/,
    );
  }
});
