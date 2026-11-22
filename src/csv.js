export function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field)
        throw new Error("Invalid CSV: unexpected quote.");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((s) => s.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("Invalid CSV: an unclosed quote.");
  row.push(field);
  if (row.some((s) => s.trim())) rows.push(row);
  return rows;
}
export const csvCell = (value) =>
  '"' + String(value ?? "").replaceAll('"', '""') + '"';
export function partsFromCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2)
    throw new Error("CSV needs a header and at least one part.");
  const header = rows.shift().map((s) => s.trim().toLowerCase());
  for (const key of ["label", "width", "length", "quantity"])
    if (!header.includes(key))
      throw new Error(
        `Missing CSV column: ${key}. Use label,width,length,quantity,material,rotate.`,
      );
  return rows.map((r, i) => {
    const get = (key) => r[header.indexOf(key)]?.trim();
    return {
      id: crypto.randomUUID(),
      label: get("label") || `Part ${i + 1}`,
      width: get("width"),
      height: get("length"),
      qty: get("quantity"),
      material: get("material") || "Plywood",
      rotate: !["false", "no", "0"].includes(get("rotate")?.toLowerCase()),
    };
  });
}
