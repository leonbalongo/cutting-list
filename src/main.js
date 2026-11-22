import "./style.css";
import { normalize } from "./optimizer.js";
import { partsFromCSV, csvCell } from "./csv.js";

const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder:
    '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  sliders:
    '<path d="M4 7h8m4 0h4M4 17h3m4 0h9"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield:
    '<path d="M12 3 3 6v6c0 5 9 9 9 9s9-4 9-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v2"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  print: '<path d="M6 9V3h12v6M6 18H3V9h18v9h-3M6 14h12v7H6Z"/>',
  leaf: '<path d="M20 3C9 2 2 7 5 15s17 7 15-12ZM5 20 16 9"/>',
  book: '<path d="M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 3-2-3-5-4-9-3Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  save: '<path d="M4 3h13l4 4v14H3V3Zm3 0v6h10V3M7 21v-8h10v8"/>',
  rotate: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9Zm-10 11 10 6 10-6M2 18l10 6 10-6"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const palette = [
  "#bcd8ca",
  "#e3d3b3",
  "#bdcfe0",
  "#d4c9df",
  "#e3bfb0",
  "#c8d7a8",
  "#e1d59f",
  "#b3d9d8",
];
const uid = () => crypto.randomUUID();
const fmt = (n) =>
  Number(n.toFixed(3)).toLocaleString("en", { maximumFractionDigits: 3 });
let storageAvailable = true;
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}
function example() {
  return {
    id: uid(),
    name: "Workshop cabinet",
    kerf: 3,
    trim: 10,
    rotation: true,
    quality: "balanced",
    parts: [
      ["Side panel", 720, 560, 2],
      ["Top & bottom", 864, 560, 2],
      ["Adjustable shelf", 864, 540, 3],
      ["Door", 716, 447, 2],
      ["Back panel", 880, 720, 1],
    ].map(([label, width, height, qty], i) => ({
      id: uid(),
      label,
      width,
      height,
      qty,
      material: "Plywood",
      rotate: true,
      color: palette[i],
    })),
    stocks: [
      {
        id: uid(),
        label: "Standard sheet",
        width: 2440,
        height: 1220,
        qty: "",
        material: "Plywood",
      },
    ],
  };
}
function validProject(p) {
  return (
    p &&
    typeof p.name === "string" &&
    Array.isArray(p.parts) &&
    Array.isArray(p.stocks) &&
    p.parts.every((r) => r && typeof r.id === "string") &&
    p.stocks.every((r) => r && typeof r.id === "string")
  );
}
const draft = read("cutcraft-draft-v1", null);
let project = validProject(draft) ? draft : example();
let result = null,
  worker = null,
  busy = false,
  progress = 0,
  selectedSheet = 0,
  selectedPart = null,
  activeTab = "layout",
  lastError = "";
let toastTimer;
const app = document.querySelector("#app");
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3400);
}
function persist() {
  store("cutcraft-draft-v1", project);
  const el = document.querySelector("#save-state");
  if (el)
    el.innerHTML = `${icon(storageAvailable ? "check" : "info")} ${storageAvailable ? "Saved on this device" : "Storage unavailable · export a backup"}`;
}
function invalidate() {
  if (worker) worker.terminate();
  worker = null;
  busy = false;
  result = null;
  lastError = "";
  selectedPart = null;
  persist();
  renderResults();
  renderMetrics();
  updateOptimize();
}
function input(row, group, key, label, type = "number", extra = "") {
  return `<input aria-label="${esc(label)}" data-group="${group}" data-id="${esc(row.id)}" data-key="${key}" type="${type}" value="${esc(row[key])}" ${type === "number" ? `min="${key === "qty" ? 1 : 0.001}" step="${key === "qty" ? 1 : 0.001}"` : ""} ${extra}>`;
}
function partRows() {
  return (
    project.parts
      .map(
        (p, i) => `<tr class="part-row">
    <td><span class="part-dot" style="background:${palette[i % palette.length]}"></span>${input(p, "parts", "label", `Part ${i + 1} label`, "text")}</td>
    <td>${input(p, "parts", "width", `${p.label} width`)}</td><td>${input(p, "parts", "height", `${p.label} length`)}</td><td>${input(p, "parts", "qty", `${p.label} quantity`)}</td>
    <td><input class="material-input" aria-label="${esc(p.label)} material" data-group="parts" data-id="${esc(p.id)}" data-key="material" value="${esc(p.material)}" list="materials"></td>
    <td class="center"><input type="checkbox" data-group="parts" data-id="${esc(p.id)}" data-key="rotate" aria-label="Allow rotation for ${esc(p.label)}" ${p.rotate ? "checked" : ""} title="Uncheck to preserve grain direction"></td>
    <td><button class="icon-button delete" data-action="remove-part" data-id="${esc(p.id)}" aria-label="Delete ${esc(p.label)}">${icon("trash")}</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="7" class="table-empty">Your next project starts with a part. Add one below.</td></tr>'
  );
}
function stockRows() {
  return (
    project.stocks
      .map(
        (s, i) =>
          `<tr><td><span class="stock-symbol">${icon("layers")}</span>${input(s, "stocks", "label", `Stock ${i + 1} label`, "text")}</td><td>${input(s, "stocks", "width", `${s.label} width`)}</td><td>${input(s, "stocks", "height", `${s.label} length`)}</td><td>${input(s, "stocks", "qty", `${s.label} available quantity`, "number", 'placeholder="∞" title="Leave blank for unlimited sheets"')}</td><td>${input(s, "stocks", "material", `${s.label} material`, "text", 'list="materials"')}</td><td><button class="icon-button delete" data-action="remove-stock" data-id="${esc(s.id)}" aria-label="Delete ${esc(s.label)}">${icon("trash")}</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="6" class="table-empty">Add a stock sheet to get started.</td></tr>'
  );
}
function render() {
  app.innerHTML = `<header class="topbar"><div class="topbar-inner">
    <a class="brand" href="/" aria-label="Cutcraft home"><img src="/icon.svg" alt="" width="34" height="34">cutcraft<span class="brand-period">.</span></a>
    <nav aria-label="Main navigation"><button class="nav-link active" data-action="workspace">${icon("grid")} Workspace</button><button class="nav-link" data-action="projects">${icon("folder")} My projects</button><button class="nav-link" data-action="guide">${icon("book")} Quick guide</button></nav>
    <div class="topbar-right"><span class="local-badge"><span></span>100% local. Always free.</span><button class="avatar" data-action="guide" aria-label="About Cutcraft">C</button></div>
  </div></header>
  <main><div class="breadcrumb">Workspace ${icon("chevron")} <span>Cutting optimizer</span></div>
    <section class="page-heading"><div><div class="eyebrow">LESS WASTE. MORE POSSIBILITIES.</div><h1>A better cut starts here<span>.</span></h1><p>Turn your cut list into a smarter plan. Keep more of every sheet.</p></div><button class="button secondary" data-action="new">${icon("plus")} New project</button></section>
    <section class="project-bar"><div class="project-name-wrap"><span class="project-folder">${icon("folder")}</span><div><label class="sr-only" for="project-name">Project name</label><input id="project-name" value="${esc(project.name)}" maxlength="100" aria-label="Project name"><span id="save-state">${icon("check")} Saved on this device</span></div></div><div class="project-actions"><span class="unit-badge">Millimeters <b>mm</b></span><button class="button small secondary" data-action="save">${icon("save")} Save project</button></div></section>
    <section class="metrics" id="metrics"></section>
    <div class="workspace-grid"><section class="inputs-column" aria-label="Project inputs">
      <div class="card parts-card"><div class="card-header"><div><h2>${icon("grid")} Parts to cut <span class="count-pill" id="part-count">${project.parts.length}</span></h2><p>The pieces that bring your project together.</p></div><button class="button text-button" data-action="import">${icon("upload")} Import CSV</button></div>
      <div class="table-scroll"><table class="parts-table"><colgroup><col class="name-col"><col><col><col class="qty-col"><col class="material-col"><col class="rotate-col"><col class="action-col"></colgroup><thead><tr><th>PART NAME</th><th>WIDTH</th><th>LENGTH</th><th>QTY</th><th>MATERIAL</th><th title="Allow rotation" class="center">${icon("rotate")}</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${partRows()}</tbody></table></div>
      <div class="table-footer"><button class="button text-button" data-action="add-part">${icon("plus")} Add part</button><span>${icon("rotate")} Rotation allowed when checked</span></div></div>
      <div class="card stock-card"><div class="card-header"><div><h2>${icon("layers")} Stock sheets <span class="count-pill">${project.stocks.length}</span></h2><p>What you have to work with.</p></div><span class="mini-tag">Blank quantity = unlimited</span></div>
      <div class="table-scroll"><table class="stock-table"><colgroup><col class="name-col"><col><col><col class="qty-col"><col class="material-col"><col class="action-col"></colgroup><thead><tr><th>SHEET NAME</th><th>WIDTH</th><th>LENGTH</th><th>QTY</th><th>MATERIAL</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${stockRows()}</tbody></table></div><div class="table-footer"><button class="button text-button" data-action="add-stock">${icon("plus")} Add sheet</button><span>Match materials to your parts</span></div></div>
      <div class="card settings-card"><div class="card-header"><div><h2>${icon("sliders")} Cut settings</h2></div><button class="icon-button" data-action="settings-help" aria-label="Explain cut settings">${icon("info")}</button></div>
      <div class="settings-fields"><label>Saw kerf <span class="input-unit"><input id="kerf" type="number" min="0" step="0.001" value="${esc(project.kerf)}"><span>mm</span></span></label><label>Edge trim <span class="input-unit"><input id="trim" type="number" min="0" step="0.001" value="${esc(project.trim)}"><span>mm</span></span></label><label>Optimization<select id="quality"><option value="quick" ${project.quality === "quick" ? "selected" : ""}>Quick · 4 passes</option><option value="balanced" ${project.quality === "balanced" ? "selected" : ""}>Balanced · 12 passes</option><option value="thorough" ${project.quality === "thorough" ? "selected" : ""}>Thorough · 36 passes</option></select></label></div>
      <div class="rotation-setting"><div>${icon("rotate")} <span>Allow part rotation<small>Turn parts 90° for a better fit</small></span></div><label class="switch"><input type="checkbox" id="rotation" ${project.rotation ? "checked" : ""} aria-label="Allow part rotation"><span></span></label></div></div>
      <button class="button primary optimize" data-action="optimize" id="optimize-button">${icon("grid")} Optimize cutting layout ${icon("arrow")}</button>
      <p class="privacy-note">${icon("shield")} Your project stays on your device. No uploads. No limits.</p>
    </section><section class="card results-card" id="results" aria-label="Cutting layout"></section></div>
    <div class="bottom-note"><div class="leaf-icon">${icon("leaf")}</div><div><strong>A little planning. A lot less waste.</strong><span>Good projects start with making the most of what you have.</span></div><span class="independent-tag">Independently built. Made for makers.</span></div>
  </main><footer><span><b>cutcraft.</b> Make every sheet count.</span><span>No subscriptions. No accounts. Just better cuts.</span><button data-action="guide">Help & shortcuts ${icon("chevron")}</button></footer>
  <datalist id="materials">${[...new Set(["Plywood", "MDF", "Melamine", ...project.parts.map((p) => p.material), ...project.stocks.map((s) => s.material)])].map((m) => `<option value="${esc(m)}">`).join("")}</datalist>
  <input type="file" id="file-input" accept=".csv,.json" hidden><dialog id="dialog"></dialog>`;
  renderMetrics();
  renderResults();
  updateOptimize();
}
function renderMetrics() {
  const count = project.parts.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  const area =
    project.parts.reduce(
      (s, p) => s + (Number(p.width) * Number(p.height) * Number(p.qty) || 0),
      0,
    ) / 1e6;
  const metrics = [
    ["grid", "TOTAL PARTS", count, `${project.parts.length} unique sizes`],
    [
      "layers",
      "SHEETS NEEDED",
      result ? result.sheets.length : "—",
      result
        ? `${result.sheets.length === 1 ? "Sheet" : "Sheets"} in this layout`
        : "Ready to calculate",
    ],
    [
      "leaf",
      "MATERIAL UTILIZATION",
      result ? `${result.utilization.toFixed(1)}<span>%</span>` : "—",
      result
        ? `${((result.stockArea - result.usedArea) / 1e12).toFixed(2)} m² remaining incl. kerf`
        : "Optimize to see your savings",
    ],
    [
      "grid",
      "TOTAL PART AREA",
      `${area.toFixed(2)}<span>m²</span>`,
      "Net area of all requested parts",
    ],
  ];
  document.querySelector("#metrics").innerHTML = metrics
    .map(
      ([ic, label, value, sub], i) =>
        `<div class="metric ${i === 2 ? "green-metric" : ""}"><div class="metric-top">${label}${icon(ic)}</div><strong>${value}</strong><small>${sub}</small></div>`,
    )
    .join("");
}
function sheetSVG(sheet, index, standalone = false) {
  const scale = result.scale,
    w = sheet.w / scale,
    h = sheet.h / scale;
  const margin = Math.max(w, h) * 0.043;
  const font = Math.max(w, h) * 0.017;
  let shapes = `<rect x="0" y="0" width="${w}" height="${h}" fill="#e8dfcf" stroke="#c2b7a3" stroke-width="${w * 0.001}"/>`;
  if (result.trim)
    shapes += `<rect x="${result.trim / scale}" y="${result.trim / scale}" width="${w - (result.trim * 2) / scale}" height="${h - (result.trim * 2) / scale}" fill="#f4efe5" stroke="#c3b9a7" stroke-dasharray="8 6" stroke-width="1.5"/>`;
  for (const [i, p] of sheet.placements.entries()) {
    const x = p.x / scale,
      y = p.y / scale,
      pw = p.w / scale,
      ph = p.h / scale;
    const color =
      palette[
        Math.max(
          0,
          project.parts.findIndex((part) => part.id === p.partId),
        ) % palette.length
      ];
    const isSelected =
      selectedPart?.sheet === index && selectedPart?.placement === i;
    const large = pw > w * 0.12 && ph > h * 0.14;
    const tiny = pw < w * 0.065 || ph < h * 0.09;
    const title = `${p.label} · ${fmt(pw)} × ${fmt(ph)} mm${p.rotated ? " · rotated" : ""}`;
    shapes += `<g ${!standalone ? `data-action="select-part" data-sheet="${index}" data-placement="${i}" tabindex="0" role="button" aria-label="${esc(title)}"` : ""}><title>${esc(title)}</title><rect x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${color}" stroke="${isSelected ? "#145b4c" : "#ffffff"}" stroke-width="${isSelected ? 8 : Math.max(1.5, w * 0.0008)}"/>${tiny ? "" : `<text x="${x + pw / 2}" y="${y + ph / 2 - (large ? font * 0.35 : 0)}" fill="#33483f" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="${Math.min(font, (pw / Math.max(String(p.label).length, 6)) * 1.5)}" font-weight="600">${esc(p.label)}</text>${large ? `<text x="${x + pw / 2}" y="${y + ph / 2 + font * 1.1}" fill="#53675c" text-anchor="middle" font-family="Arial,sans-serif" font-size="${font * 0.78}">${fmt(pw)} × ${fmt(ph)}${p.rotated ? " ↻" : ""}</text>` : ""}`}</g>`;
  }
  shapes += `<text x="${w / 2}" y="${-margin * 0.34}" text-anchor="middle" fill="#7d867f" font-family="Arial,sans-serif" font-size="${font * 0.85}">${fmt(w)} mm</text><text x="${-margin * 0.45}" y="${h / 2}" text-anchor="middle" fill="#7d867f" font-family="Arial,sans-serif" font-size="${font * 0.85}" transform="rotate(-90 ${-margin * 0.45} ${h / 2})">${fmt(h)} mm</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-margin} ${-margin} ${w + margin * 2} ${h + margin * 2}" class="sheet-svg" role="img" aria-label="Cutting plan for sheet ${index + 1}" ${standalone ? `width="${w}" height="${h}"` : ""}>${shapes}</svg>`;
}
function renderResults() {
  const el = document.querySelector("#results");
  if (!el) return;
  el.innerHTML = `<div class="card-header result-header"><div><h2>${icon("grid")} Cutting layout</h2><p>Your plan, from sheet to finished pieces.</p></div><span class="${result ? "ready-tag" : "mini-tag"}">${result ? `${icon("check")} Layout ready` : busy ? "Calculating…" : "Ready when you are"}</span></div>
    <div class="result-toolbar"><div class="segmented"><button class="${activeTab === "layout" ? "selected" : ""}" data-action="tab-layout">${icon("grid")} Layout</button><button class="${activeTab === "summary" ? "selected" : ""}" data-action="tab-summary">${icon("layers")} Cut list</button></div><div><button class="icon-button" data-action="fullscreen" aria-label="Enlarge cutting layout" title="Enlarge layout">${icon("expand")}</button><button class="icon-button" data-action="print" aria-label="Print all cutting sheets" title="Print / save PDF">${icon("print")}</button></div></div>
    ${busy ? `<div class="busy-panel"><span class="spinner"></span><h3>Finding a better fit</h3><p>Comparing cutting layouts on your device…</p><progress max="100" value="${progress}"></progress><button class="button secondary small" data-action="cancel">Cancel optimization</button></div>` : result ? renderLayout() : `<div class="empty-state"><div class="empty-sheet"><span></span><span></span><span></span><span></span></div><h3>${lastError ? "Let’s check your cut list" : "A place for every piece."}</h3><p>${lastError ? esc(lastError) : "Add your parts and stock sheets, then optimize<br>to find your next cutting plan."}</p><button class="button secondary" data-action="optimize">${icon("grid")} Optimize layout</button></div>`}
    <div class="results-bottom"><span>${icon("shield")} Calculated locally</span><button class="button small ${result ? "secondary" : "disabled-look"}" data-action="export">${icon("download")} Export plan ${icon("down")}</button></div>`;
}
function renderLayout() {
  const sheet = result.sheets[selectedSheet] || result.sheets[0];
  selectedSheet = Math.min(
    selectedSheet,
    Math.max(0, result.sheets.length - 1),
  );
  if (!sheet)
    return `<div class="empty-state"><h3>No parts could be placed</h3><p>Check stock dimensions, matching materials, quantities, and grain direction.</p><div class="warning">${result.unplaced.length} parts do not fit the available stock.</div></div>`;
  const used =
    (sheet.placements.reduce((a, p) => a + p.w * p.h, 0) /
      (sheet.w * sheet.h)) *
    100;
  const selected =
    selectedPart?.sheet === selectedSheet
      ? sheet.placements[selectedPart.placement]
      : null;
  return `${result.unplaced.length ? `<div class="warning">${icon("info")} ${result.unplaced.length} part${result.unplaced.length === 1 ? "" : "s"} unplaced. Check sizes, materials, grain and stock quantity. <button data-action="unplaced">View parts</button></div>` : ""}
    <div class="sheet-tabs">${result.sheets.map((s, i) => `<button class="sheet-tab ${i === selectedSheet ? "active" : ""}" data-action="sheet" data-index="${i}">${icon("layers")} Sheet ${String(i + 1).padStart(2, "0")}<span>${s.placements.length} parts</span></button>`).join("")}</div>
    ${
      activeTab === "layout"
        ? `<div class="diagram-container">${sheetSVG(sheet, selectedSheet)}</div><div class="diagram-caption"><span>${icon("layers")} ${esc(sheet.material)} <b>·</b> ${fmt(sheet.w / result.scale)} × ${fmt(sheet.h / result.scale)} mm</span><span>${used.toFixed(1)}% used</span></div>
    <div class="legend"><span><i style="background:#e8dfcf"></i>Offcut / waste</span><span><i class="kerf-legend"></i>${esc(project.kerf)} mm saw kerf</span><span class="legend-hint">Click a piece for details</span></div>
    ${
      selected
        ? `<div class="part-inspector"><span class="inspector-dot" style="background:${
            palette[
              Math.max(
                0,
                project.parts.findIndex((p) => p.id === selected.partId),
              ) % palette.length
            ]
          }"></span><div><strong>${esc(selected.label)} <small>#${selected.instance}</small></strong><span>${fmt(selected.w / result.scale)} × ${fmt(selected.h / result.scale)} mm · ${selected.rotated ? "Rotated 90°" : "Original orientation"} · Position ${fmt(selected.x / result.scale)}, ${fmt(selected.y / result.scale)} mm</span></div><button class="icon-button" data-action="deselect" aria-label="Close part details">${icon("close")}</button></div>`
        : ""
    }`
        : `<div class="cutlist-wrap"><table class="cutlist-table"><thead><tr><th>PART</th><th>SIZE (mm)</th><th>X / Y (mm)</th><th>ROTATED</th></tr></thead><tbody>${sheet.placements.map((p) => `<tr><td>${esc(p.label)} <small>#${p.instance}</small></td><td>${fmt(p.w / result.scale)} × ${fmt(p.h / result.scale)}</td><td>${fmt(p.x / result.scale)} / ${fmt(p.y / result.scale)}</td><td>${p.rotated ? "Yes" : "No"}</td></tr>`).join("")}</tbody></table></div>`
    }
    <div class="layout-stats"><div><span class="success-icon">${icon("check")}</span><div><strong>${result.unplaced.length ? "Partial layout generated" : "Every piece has its place"}</strong><span>${result.sheets.reduce((n, s) => n + s.placements.length, 0)} parts placed across ${result.sheets.length} sheet${result.sheets.length === 1 ? "" : "s"}</span></div></div><span class="duration">${icon("clock")} ${result.duration < 1000 ? `${Math.max(1, Math.round(result.duration))} ms` : `${(result.duration / 1000).toFixed(1)} s`}</span></div>
    <div class="utilization-block"><div><span>Material utilization</span><strong>${result.utilization.toFixed(1)}%</strong></div><div class="utilization-track"><span style="width:${result.utilization}%"></span></div><p>${icon("info")} Multi-pass guillotine layout. Verify measurements before cutting.</p></div>`;
}
function updateOptimize() {
  const btn = document.querySelector("#optimize-button");
  if (btn) {
    btn.innerHTML = busy
      ? `<span class="spinner small-spinner"></span> Optimizing… <span class="cancel-word">Cancel</span>`
      : `${icon("grid")} Optimize cutting layout ${icon("arrow")}`;
  }
}
function run() {
  if (busy) {
    cancel();
    return;
  }
  try {
    normalize(project);
  } catch (e) {
    lastError = e.message;
    result = null;
    renderResults();
    renderMetrics();
    toast(e.message);
    return;
  }
  busy = true;
  progress = 0;
  lastError = "";
  selectedPart = null;
  selectedSheet = 0;
  updateOptimize();
  renderResults();
  worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  worker.onmessage = ({ data }) => {
    if (data.type === "progress") {
      progress = data.progress;
      const p = document.querySelector("progress");
      if (p) p.value = progress;
      return;
    }
    busy = false;
    worker.terminate();
    worker = null;
    if (data.type === "result") {
      result = data.result;
      toast(
        result.unplaced.length
          ? `Layout ready · ${result.unplaced.length} parts could not be placed`
          : "Your cutting layout is ready",
      );
    } else {
      result = null;
      lastError = data.message;
      toast(data.message);
    }
    updateOptimize();
    renderResults();
    renderMetrics();
  };
  worker.onerror = () => {
    busy = false;
    worker?.terminate();
    worker = null;
    lastError =
      "The optimizer could not finish. Try Quick mode or a smaller batch if device memory is limited.";
    result = null;
    updateOptimize();
    renderResults();
    renderMetrics();
    toast(lastError);
  };
  worker.postMessage(project);
}
function cancel() {
  worker?.terminate();
  worker = null;
  busy = false;
  updateOptimize();
  renderResults();
  toast("Optimization cancelled. Your cut list is unchanged.");
}
function modal(title, content, wide = false) {
  const dialog = document.querySelector("#dialog");
  if (dialog.open) dialog.close();
  dialog.className = wide ? "wide-dialog" : "";
  dialog.innerHTML = `<div class="modal-header"><h2>${esc(title)}</h2><button class="icon-button" data-action="close-dialog" aria-label="Close dialog">${icon("close")}</button></div><div class="modal-content">${content}</div>`;
  dialog.showModal();
}
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const filename = () =>
  project.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "cutcraft-project";
function saveProject() {
  persist();
  const projects = read("cutcraft-projects-v1", []).filter(validProject);
  const saved = { ...project, updated: new Date().toISOString() };
  const index = projects.findIndex((p) => p.id === project.id);
  if (index < 0) projects.unshift(saved);
  else projects[index] = saved;
  toast(
    store("cutcraft-projects-v1", projects)
      ? "Project saved on this device"
      : "Device storage is full. Export a JSON backup instead.",
  );
}
function showProjects() {
  const projects = read("cutcraft-projects-v1", []).filter(validProject);
  modal(
    "My projects",
    `<p class="modal-intro">Saved in this browser, on this device. Export JSON to back up or move a project.</p><div class="project-list">${projects.length ? projects.map((p) => `<div class="saved-project"><span class="project-folder">${icon("folder")}</span><button class="project-open" data-action="load-project" data-id="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${p.parts.length} part types · ${new Date(p.updated).toLocaleDateString()}</small></button><button class="icon-button" data-action="delete-project" data-id="${esc(p.id)}" aria-label="Delete saved ${esc(p.name)}">${icon("trash")}</button></div>`).join("") : '<div class="modal-empty">No saved projects yet. Use “Save project” to keep this one.</div>'}</div><button class="button secondary" data-action="import-json">${icon("upload")} Open project JSON</button>`,
  );
}
function printPlan() {
  if (!result?.sheets.length) {
    toast("Optimize a layout before printing.");
    return;
  }
  document.querySelector("#print-area")?.remove();
  const section = document.createElement("section");
  section.id = "print-area";
  section.innerHTML = result.sheets
    .map(
      (s, i) =>
        `<article><div class="print-heading"><h1>${esc(project.name)}</h1><span>cutcraft. · Sheet ${i + 1} / ${result.sheets.length}</span></div><p>${esc(s.material)} · ${fmt(s.w / result.scale)} × ${fmt(s.h / result.scale)} mm · Kerf ${esc(project.kerf)} mm · Edge trim ${esc(project.trim)} mm</p>${sheetSVG(s, i, true)}<p>${s.placements.length} pieces · Dimensions in millimeters · Diagram not to physical scale. Verify before cutting.</p><table><thead><tr><th>Part</th><th>Instance</th><th>Width</th><th>Length</th><th>X</th><th>Y</th><th>Rotated</th></tr></thead><tbody>${s.placements.map((p) => `<tr><td>${esc(p.label)}</td><td>${p.instance}</td><td>${fmt(p.w / result.scale)}</td><td>${fmt(p.h / result.scale)}</td><td>${fmt(p.x / result.scale)}</td><td>${fmt(p.y / result.scale)}</td><td>${p.rotated ? "Yes" : "No"}</td></tr>`).join("")}</tbody></table>${result.unplaced.length ? `<p>Warning: ${result.unplaced.length} requested parts unplaced.</p>` : ""}</article>`,
    )
    .join("");
  document.body.append(section);
  window.print();
}

app.addEventListener("input", (event) => {
  const el = event.target;
  if (el.id === "project-name") {
    project.name = el.value;
    persist();
    return;
  }
  if (el.dataset.group) {
    const row = project[el.dataset.group].find((p) => p.id === el.dataset.id);
    if (!row) return;
    row[el.dataset.key] = el.type === "checkbox" ? el.checked : el.value;
    invalidate();
  } else if (["kerf", "trim", "quality", "rotation"].includes(el.id)) {
    project[el.id] = el.type === "checkbox" ? el.checked : el.value;
    invalidate();
  }
});
app.addEventListener("change", async (event) => {
  if (event.target.id !== "file-input") return;
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".json")) {
      const incoming = JSON.parse(text);
      if (!validProject(incoming))
        throw new Error("This is not a Cutcraft project JSON file.");
      normalize(incoming);
      if (
        !confirm(
          "Replace the current workspace with this project? Saved projects will be kept.",
        )
      )
        return;
      project = incoming;
    } else {
      const parts = partsFromCSV(text).map((p, i) => ({
        ...p,
        color: palette[i % palette.length],
      }));
      normalize({ ...project, parts });
      if (
        project.parts.length &&
        !confirm(
          `Replace the current part list with ${parts.length} imported rows?`,
        )
      )
        return;
      project.parts = parts;
    }
    document.querySelector("#dialog").close();
    invalidate();
    render();
    toast("Imported successfully");
  } catch (e) {
    toast(`Import failed: ${e.message}`);
  } finally {
    const el = document.querySelector("#file-input");
    if (el) el.value = "";
  }
});
app.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches('[data-action="select-part"]')
  ) {
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
app.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  switch (action) {
    case "workspace":
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;
    case "optimize":
      run();
      break;
    case "cancel":
      cancel();
      break;
    case "add-part":
      project.parts.push({
        id: uid(),
        label: `Part ${project.parts.length + 1}`,
        width: 600,
        height: 400,
        qty: 1,
        material: project.stocks[0]?.material || "Plywood",
        rotate: true,
        color: palette[project.parts.length % palette.length],
      });
      invalidate();
      render();
      document.querySelector(".parts-table tbody tr:last-child input")?.focus();
      break;
    case "remove-part":
      project.parts = project.parts.filter((p) => p.id !== btn.dataset.id);
      invalidate();
      render();
      break;
    case "add-stock":
      project.stocks.push({
        id: uid(),
        label: "Stock sheet",
        width: 2440,
        height: 1220,
        qty: "",
        material: "Plywood",
      });
      invalidate();
      render();
      break;
    case "remove-stock":
      project.stocks = project.stocks.filter((p) => p.id !== btn.dataset.id);
      invalidate();
      render();
      break;
    case "sheet":
      selectedSheet = Number(btn.dataset.index);
      selectedPart = null;
      renderResults();
      break;
    case "tab-layout":
      activeTab = "layout";
      renderResults();
      break;
    case "tab-summary":
      activeTab = "summary";
      renderResults();
      break;
    case "select-part":
      selectedPart = {
        sheet: Number(btn.dataset.sheet),
        placement: Number(btn.dataset.placement),
      };
      renderResults();
      break;
    case "deselect":
      selectedPart = null;
      renderResults();
      break;
    case "save":
      saveProject();
      break;
    case "projects":
      showProjects();
      break;
    case "load-project": {
      const p = read("cutcraft-projects-v1", []).find(
        (p) => p.id === btn.dataset.id,
      );
      if (!p) break;
      if (
        !confirm(
          "Open this saved project? Your current workspace will be replaced.",
        )
      )
        break;
      project = p;
      document.querySelector("#dialog").close();
      invalidate();
      render();
      run();
      break;
    }
    case "delete-project":
      if (confirm("Delete this saved project?")) {
        store(
          "cutcraft-projects-v1",
          read("cutcraft-projects-v1", []).filter(
            (p) => p.id !== btn.dataset.id,
          ),
        );
        showProjects();
      }
      break;
    case "new":
      modal(
        "Start something new",
        `<p class="modal-intro">Your current workspace is auto-saved as you work. Save it to My projects before replacing it.</p><div class="new-options"><button data-action="new-blank"><span>${icon("plus")}</span><strong>Blank project</strong><small>A fresh sheet for your next idea</small></button><button data-action="new-demo"><span>${icon("folder")}</span><strong>Example cabinet</strong><small>Explore a ready-to-cut project</small></button></div>`,
      );
      break;
    case "new-blank":
    case "new-demo": {
      if (
        !confirm(
          "Replace the workspace? Use Save project first to keep the current project.",
        )
      )
        break;
      document.querySelector("#dialog").close();
      project = example();
      if (action === "new-blank") {
        project.name = "Untitled project";
        project.parts = [];
      }
      invalidate();
      render();
      if (action === "new-demo") run();
      break;
    }
    case "close-dialog":
      document.querySelector("#dialog").close();
      break;
    case "import":
      modal(
        "Import your cut list",
        `<p class="modal-intro">Import a CSV with these column names. Dimensions are in millimeters; quantity is a whole number.</p><pre>label,width,length,quantity,material,rotate\nSide panel,720,560,2,Plywood,true\nShelf,864,540,3,Plywood,false</pre><p>Material and rotate are optional. Set rotate to false for grain-sensitive parts. Import replaces the current parts list.</p><div class="modal-actions"><button class="button secondary" data-action="csv-template">${icon("download")} Download template</button><button class="button primary" data-action="choose-csv">${icon("upload")} Choose CSV</button></div>`,
      );
      break;
    case "choose-csv":
    case "import-json": {
      const input = document.querySelector("#file-input");
      input.accept = action === "choose-csv" ? ".csv" : ".json";
      input.click();
      break;
    }
    case "csv-template":
      download(
        "cutcraft-template.csv",
        "label,width,length,quantity,material,rotate\nSide panel,720,560,2,Plywood,true\nShelf,864,540,3,Plywood,false\n",
        "text/csv",
      );
      break;
    case "export":
      modal(
        "Take your plan to the workshop",
        `<p class="modal-intro">Export your project anytime. No account or subscription needed.</p><div class="export-options"><button data-action="export-json">${icon("folder")}<span><strong>Project backup</strong><small>JSON · editable in Cutcraft, including inputs</small></span>${icon("download")}</button><button data-action="export-csv">${icon("grid")}<span><strong>Parts list</strong><small>CSV · your requested parts and quantities</small></span>${icon("download")}</button>${result?.sheets.length ? `<button data-action="export-svg">${icon("layers")}<span><strong>Current sheet diagram</strong><small>SVG · scalable layout for sheet ${selectedSheet + 1}</small></span>${icon("download")}</button><button data-action="export-layout">${icon("grid")}<span><strong>Placement coordinates</strong><small>CSV · all sheets, dimensions, positions and rotation</small></span>${icon("download")}</button><button data-action="print">${icon("print")}<span><strong>Print / save as PDF</strong><small>Every sheet, with its placement list</small></span>${icon("chevron")}</button>` : "<p>Optimize a layout to unlock diagram and placement exports.</p>"}</div>`,
      );
      break;
    case "export-json":
      download(
        `${filename()}.json`,
        JSON.stringify(project, null, 2),
        "application/json",
      );
      break;
    case "export-csv":
      download(
        `${filename()}-parts.csv`,
        [
          "label,width,length,quantity,material,rotate",
          ...project.parts.map((p) =>
            [p.label, p.width, p.height, p.qty, p.material, p.rotate]
              .map(csvCell)
              .join(","),
          ),
        ].join("\r\n"),
        "text/csv",
      );
      break;
    case "export-layout":
      if (result)
        download(
          `${filename()}-placements.csv`,
          [
            "sheet,material,label,instance,width_mm,length_mm,x_mm,y_mm,rotated",
            ...result.sheets.flatMap((s, i) =>
              s.placements.map((p) =>
                [
                  i + 1,
                  s.material,
                  p.label,
                  p.instance,
                  p.w / result.scale,
                  p.h / result.scale,
                  p.x / result.scale,
                  p.y / result.scale,
                  p.rotated,
                ]
                  .map(csvCell)
                  .join(","),
              ),
            ),
          ].join("\r\n"),
          "text/csv",
        );
      break;
    case "export-svg":
      if (result?.sheets[selectedSheet])
        download(
          `${filename()}-sheet-${selectedSheet + 1}.svg`,
          sheetSVG(result.sheets[selectedSheet], selectedSheet, true),
          "image/svg+xml",
        );
      break;
    case "print":
      document.querySelector("#dialog")?.close();
      printPlan();
      break;
    case "fullscreen":
      if (result?.sheets.length) {
        modal(
          `Sheet ${selectedSheet + 1} · ${project.name}`,
          `<div class="enlarged-diagram">${sheetSVG(result.sheets[selectedSheet], selectedSheet, true)}</div>`,
          true,
        );
      } else toast("Optimize a layout first to enlarge it.");
      break;
    case "unplaced":
      modal(
        "Parts that could not be placed",
        `<p>Check dimensions, material names, available stock, and rotation. Material names must match exactly.</p><ul class="unplaced-list">${result.unplaced.map((p) => `<li>${esc(p.label)} · instance ${p.instance}</li>`).join("")}</ul>`,
      );
      break;
    case "guide":
    case "settings-help":
      modal(
        action === "guide"
          ? "A little planning goes a long way"
          : "Fine-tune your cuts",
        `<div class="guide"><div><span>01</span><section><h3>Add your parts & stock</h3><p>Enter width, length, and quantity in millimeters (up to 3 decimal places). Materials must match exactly. A blank stock quantity means an unlimited supply.</p></section></div><div><span>02</span><section><h3>Account for the real world</h3><p><b>Saw kerf</b> is the material your blade removes between parts. <b>Edge trim</b> is removed from all four stock edges. Uncheck a part’s rotation box to keep its width/length grain orientation; turn off global rotation to lock every part.</p></section></div><div><span>03</span><section><h3>Find your fit</h3><p>Optimization runs in a background worker. Quick, Balanced and Thorough compare 4, 12 and 36 guillotine arrangements. These are heuristics, not a guarantee of the mathematically best result. Check every dimension before cutting.</p></section></div><div><span>04</span><section><h3>Keep it yours</h3><p>No account, billing, cloud upload or imposed part quota. Projects live in this browser; clearing browser data removes them. Export JSON for backups. Device memory and speed are the practical limits. Press <kbd>Ctrl / ⌘ S</kbd> to save or <kbd>Ctrl / ⌘ Enter</kbd> to optimize.</p></section></div></div>`,
      );
      break;
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveProject();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    run();
  }
});
render();
persist();
run();
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
