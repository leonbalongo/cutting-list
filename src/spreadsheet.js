import { read, utils } from "@e965/xlsx";
import { normalize } from "./optimizer.js";
import { grainAxis } from "./grain.js";

const aliases = {
  label: [
    "label",
    "name",
    "part",
    "partname",
    "description",
    "item",
    "itemname",
  ],
  width: ["width", "w", "widthmm", "wmm"],
  length: ["length", "height", "l", "h", "lengthmm", "heightmm", "lmm", "hmm"],
  qty: ["quantity", "qty", "count", "pieces", "pcs", "number"],
  material: ["material", "board", "materialname"],
  rotate: ["rotate", "rotation", "allowrotation"],
  grain: ["grain", "graindirection", "grainaxis"],
  enabled: ["enabled", "active", "include"],
};
const headerKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const blank = (value) =>
  value === undefined || value === null || String(value).trim() === "";
function booleanCell(value, fallback, label) {
  if (blank(value)) return fallback;
  if (
    ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase())
  )
    return true;
  if (
    ["0", "false", "no", "n", "off"].includes(
      String(value).trim().toLowerCase(),
    )
  )
    return false;
  throw new Error(`${label}: use true/false, yes/no, or 1/0.`);
}

export function measurementRows(rows) {
  let columns,
    headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const keys = rows[i].map(headerKey);
    const mapping = Object.fromEntries(
      Object.entries(aliases).map(([key, values]) => [
        key,
        keys.findIndex((k) => values.includes(k)),
      ]),
    );
    if (["width", "length", "qty"].every((key) => mapping[key] >= 0)) {
      for (const [key, names] of Object.entries(aliases))
        if (keys.filter((k) => names.includes(k)).length > 1)
          throw new Error(
            `Duplicate ${key} columns in row ${i + 1}. Keep one column for each measurement.`,
          );
      columns = mapping;
      headerRow = i;
      break;
    }
  }
  if (!columns)
    throw new Error(
      "No measurement header found. Include Width, Length (or Height), and Quantity (or Qty/Count). Dimensions must be in millimeters.",
    );
  const parts = [];
  let skipped = 0;
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.some((cell) => !blank(cell))) continue;
    const get = (key) => row[columns[key]];
    if (!booleanCell(get("enabled"), true, `Row ${i + 1} Enabled`)) {
      skipped++;
      continue;
    }
    // A note below the table is not a measurement row. Partially filled rows
    // are deliberately validated and rejected, never silently dropped.
    if (["width", "length", "qty"].every((key) => blank(get(key)))) {
      skipped++;
      continue;
    }
    const axis = blank(get("grain"))
      ? "length"
      : String(get("grain")).trim().toLowerCase();
    const grain = grainAxis(
      {
        l: "length",
        h: "length",
        height: "length",
        w: "width",
        no: "none",
        any: "none",
      }[axis] || axis,
    );
    const part = {
      id: crypto.randomUUID(),
      label: blank(get("label"))
        ? `Part ${String(parts.length + 1).padStart(3, "0")}`
        : String(get("label")).trim(),
      width: get("width"),
      height: get("length"),
      qty: get("qty"),
      material: blank(get("material"))
        ? "Plywood"
        : String(get("material")).trim(),
      rotate: booleanCell(get("rotate"), true, `Row ${i + 1} Rotate`),
      grain,
    };
    try {
      normalize({
        parts: [part],
        stocks: [{ width: 1, height: 1, qty: "", material: part.material }],
        kerf: 0,
        trim: 0,
      });
    } catch (error) {
      throw new Error(`Row ${i + 1} (${part.label}): ${error.message}`);
    }
    parts.push(part);
  }
  if (!parts.length)
    throw new Error("No enabled measurement rows found below the header.");
  return {
    parts,
    skipped,
    headerRow: headerRow + 1,
    quantity: parts.reduce((sum, part) => sum + Number(part.qty), 0),
  };
}

export function parseMeasurementWorkbook(buffer) {
  let book;
  try {
    book = read(buffer, {
      type: "array",
      cellFormula: false,
      cellHTML: false,
      cellDates: false,
      raw: true,
    });
  } catch (error) {
    throw new Error(
      `Cannot read this spreadsheet. It may be damaged, encrypted, or unsupported. Remove password protection or export as XLSX, ODS, CSV or TSV. ${error.message}`,
    );
  }
  if (!book.SheetNames?.length)
    throw new Error("The spreadsheet contains no worksheets.");
  return {
    sheets: book.SheetNames.map((name) => {
      try {
        const sheet = book.Sheets[name];
        if (sheet["!type"] && sheet["!type"] !== "worksheet")
          throw new Error("This is not a measurement worksheet.");
        const rows = utils.sheet_to_json(sheet, {
          header: 1,
          range: 0,
          raw: true,
          defval: "",
          blankrows: true,
        });
        return { name, ...measurementRows(rows) };
      } catch (error) {
        return { name, error: error.message, parts: [] };
      }
    }),
  };
}
