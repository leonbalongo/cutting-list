// Modal dialogs make the rest of the document inert. Create the file input
// INSIDE the active dialog, and click it synchronously in the user's gesture.
// A fresh input also permits retrying the same file after cancelling/failing.
export function chooseImportFile(kind) {
  if (!["csv", "json"].includes(kind)) throw new Error("Unknown import type.");
  document.querySelector("#file-input")?.remove();
  document.querySelector("#import-error")?.remove();
  const input = document.createElement("input");
  input.type = "file";
  input.id = "file-input";
  input.hidden = true;
  input.multiple = false;
  input.dataset.importKind = kind;
  input.setAttribute(
    "aria-label",
    kind === "csv" ? "Import CSV file" : "Import project JSON file",
  );
  // Android providers may label a valid CSV as text/plain, application/csv,
  // application/octet-stream, or even application/vnd.ms-excel. Let users
  // choose the file; validate its actual content rather than its MIME/name.
  input.accept = "";
  const dialog = document.querySelector("#dialog[open]");
  (dialog || document.querySelector("#app")).append(input);
  input.click();
  return input;
}

export async function readImportText(file) {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isZip = header[0] === 0x50 && header[1] === 0x4b;
  const isLegacyExcel = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
    (byte, i) => header[i] === byte,
  );
  if (isZip || isLegacyExcel) {
    throw new Error(
      "This file is an Excel workbook or ZIP archive, not plain-text CSV/JSON. In Excel or Sheets, export as CSV UTF-8; changing the filename to .csv does not convert it.",
    );
  }
  if (
    (header[0] === 0xff && header[1] === 0xfe) ||
    (header[0] === 0xfe && header[1] === 0xff)
  ) {
    throw new Error(
      "This file uses UTF-16 encoding. Save it as CSV UTF-8 before importing.",
    );
  }
  return (await file.text()).replace(/^\uFEFF/, "");
}
