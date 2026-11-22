import { jsPDF } from "jspdf";

const colors = [
  "#bcd8ca",
  "#e3d3b3",
  "#bdcfe0",
  "#d4c9df",
  "#e3bfb0",
  "#c8d7a8",
  "#e1d59f",
  "#b3d9d8",
];
const round = (n) =>
  Number(n.toFixed(3)).toLocaleString("en", { maximumFractionDigits: 3 });
export function reportStatistics(project, result) {
  const divisor = result.scale ** 2 * 1e6;
  const sheets = result.sheets.map((s) => {
    const used = s.placements.reduce((sum, p) => sum + p.w * p.h, 0);
    return {
      parts: s.placements.length,
      stockArea: (s.w * s.h) / divisor,
      usedArea: used / divisor,
      remainingArea: (s.w * s.h - used) / divisor,
      utilization: (used / (s.w * s.h)) * 100,
    };
  });
  return {
    requested: project.parts.reduce((sum, p) => sum + Number(p.qty), 0),
    placed: sheets.reduce((sum, s) => sum + s.parts, 0),
    unplaced: result.unplaced.length,
    requestedArea:
      project.parts.reduce(
        (sum, p) => sum + Number(p.width) * Number(p.height) * Number(p.qty),
        0,
      ) / 1e6,
    stockArea: result.stockArea / divisor,
    usedArea: result.usedArea / divisor,
    remainingArea: (result.stockArea - result.usedArea) / divisor,
    utilization: result.utilization,
    sheets,
  };
}

export async function loadReportFont() {
  const response = await fetch("/fonts/NotoSans-Regular.ttf");
  if (!response.ok)
    throw new Error(
      "Report font could not be loaded. Reopen the app online once, or reinstall the APK.",
    );
  const bytes = new Uint8Array(await response.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 32768)
    text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}

export function createPlanPDF(project, result, fontBase64) {
  if (!result) throw new Error("Optimize the project before exporting a PDF.");
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  if (fontBase64) {
    doc.addFileToVFS("NotoSans-Regular.ttf", fontBase64);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.setFont("NotoSans");
  }
  doc.setProperties({
    title: `${project.name} - Cutting report`,
    subject: "All cutting sheets and project statistics",
    creator: "Cutcraft",
    author: "Cutcraft",
  });
  const stats = reportStatistics(project, result);
  const text = (value, x, y, size = 10, color = "#33483f", options) => {
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(String(value), x, y, options);
  };
  const fit = (value, width, size = 9) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(value), width);
    return lines[0] + (lines.length > 1 ? "…" : "");
  };
  const header = (title, subtitle) => {
    doc.setFillColor("#145b4c");
    doc.rect(0, 0, 297, 3, "F");
    text("cutcraft.", 14, 16, 16, "#145b4c");
    text(fit(project.name, 155, 11), 283, 16, 11, "#627568", {
      align: "right",
    });
    text(title, 14, 29, 18);
    text(subtitle, 14, 37, 8, "#718275");
  };
  const keyValue = (label, value, x, y, width = 60) => {
    text(label, x, y, 8, "#718275");
    text(fit(value, width, 11), x, y + 6, 11);
  };
  header(
    "Complete cutting report",
    `Generated ${new Date().toISOString().slice(0, 10)} · All dimensions in millimeters · Areas in m²`,
  );
  const cards = [
    ["Stock sheets", result.sheets.length],
    ["Parts requested", stats.requested],
    ["Parts placed", stats.placed],
    ["Parts unplaced", stats.unplaced],
    ["Material utilization", `${stats.utilization.toFixed(1)}%`],
    ["Stock area", `${stats.stockArea.toFixed(3)} m²`],
    ["Net placed part area", `${stats.usedArea.toFixed(3)} m²`],
    ["Remaining incl. kerf", `${stats.remainingArea.toFixed(3)} m²`],
  ];
  cards.forEach(([label, value], i) => {
    const x = 14 + (i % 4) * 68,
      y = 46 + Math.floor(i / 4) * 29;
    doc.setFillColor("#f0f5ef");
    doc.roundedRect(x, y, 64, 25, 2, 2, "F");
    keyValue(label, value, x + 5, y + 8, 54);
  });
  text(
    `Saw kerf: ${project.kerf} mm   |   Four-edge trim: ${project.trim} mm   |   Grain consideration: ${result.considerGrain ? "ON" : "OFF"}`,
    14,
    114,
    10,
  );
  text(
    `Rotation: ${project.rotation === false ? "locked globally" : "allowed where part and grain settings permit"}   |   Search: ${result.trials} passes, ${(result.duration / 1000).toFixed(3)} seconds`,
    14,
    123,
    9,
  );
  text("Material summary", 14, 138, 12);
  const materials = [...new Set(result.sheets.map((s) => s.material))];
  let y = 147;
  if (!materials.length)
    text("No stock sheets used. Review the unplaced-parts appendix.", 14, y, 9);
  materials.forEach((material) => {
    if (y > 182) {
      doc.addPage();
      header(
        "Material summary (continued)",
        "Statistics cover placed parts only.",
      );
      y = 50;
    }
    const selected = result.sheets
      .map((s, i) => ({ s, stat: stats.sheets[i] }))
      .filter(({ s }) => s.material === material);
    const area = selected.reduce((sum, { stat }) => sum + stat.stockArea, 0),
      used = selected.reduce((sum, { stat }) => sum + stat.usedArea, 0);
    text(
      `${fit(material, 74)}   ·   ${selected.length} sheets   ·   ${selected.reduce((sum, { stat }) => sum + stat.parts, 0)} parts   ·   ${area.toFixed(3)} m² stock   ·   ${(area ? (used / area) * 100 : 0).toFixed(1)}% used`,
      14,
      y,
      9,
    );
    y += 8;
  });
  if (y > 165) {
    doc.addPage();
    header("Report notes", "Whole-project statistics");
    y = 50;
  }
  text(
    `Requested part area: ${stats.requestedArea.toFixed(3)} m²`,
    14,
    Math.max(159, y),
    8,
    "#718275",
  );
  text(
    "Remaining area includes trim, saw kerf and offcuts; it is not all reusable material.",
    14,
    Math.max(169, y + 3),
    8,
    "#718275",
  );
  if (stats.unplaced)
    text(
      `INCOMPLETE PLAN: ${stats.unplaced} requested parts could not be placed. See appendix.`,
      14,
      Math.max(178, y + 12),
      10,
      "#9c5f24",
    );

  result.sheets.forEach((sheet, index) => {
    doc.addPage();
    const stat = stats.sheets[index];
    header(
      `Sheet ${index + 1} of ${result.sheets.length}`,
      `${sheet.label || "Stock sheet"} · ${sheet.material} · ${round(sheet.w / result.scale)} × ${round(sheet.h / result.scale)} mm`,
    );
    const ratio = Math.min(185 / sheet.w, 132 / sheet.h),
      width = sheet.w * ratio,
      height = sheet.h * ratio;
    const x = 14 + (185 - width) / 2,
      top = 49 + (132 - height) / 2;
    doc.setDrawColor("#b9b09e");
    doc.setFillColor("#e8dfcf");
    doc.setLineWidth(0.2);
    doc.rect(x, top, width, height, "FD");
    if (result.trim) {
      doc.setFillColor("#f4efe5");
      doc.rect(
        x + result.trim * ratio,
        top + result.trim * ratio,
        width - result.trim * ratio * 2,
        height - result.trim * ratio * 2,
        "F",
      );
    }
    sheet.placements.forEach((p) => {
      const partIndex = project.parts.findIndex((part) => part.id === p.partId),
        px = x + p.x * ratio,
        py = top + p.y * ratio,
        pw = p.w * ratio,
        ph = p.h * ratio;
      doc.setFillColor(colors[Math.max(0, partIndex) % colors.length]);
      doc.setDrawColor("#ffffff");
      doc.setLineWidth(0.12);
      doc.rect(px, py, pw, ph, "FD");
      if (pw > 9 && ph > 5) {
        const size = Math.min(8, Math.max(5, pw * 0.4));
        text(
          fit(`${partIndex + 1}. ${p.label}`, Math.max(1, pw - 2), size),
          px + pw / 2,
          py + ph / 2 - (ph > 12 ? 1 : -1),
          size,
          "#33483f",
          { align: "center" },
        );
        if (ph > 12)
          text(
            `${round(p.w / result.scale)} × ${round(p.h / result.scale)}`,
            px + pw / 2,
            py + ph / 2 + 3,
            6,
            "#53675c",
            { align: "center" },
          );
      }
    });
    text(
      `${round(sheet.w / result.scale)} mm`,
      x + width / 2,
      top - 3,
      8,
      "#718275",
      { align: "center" },
    );
    text(
      `${round(sheet.h / result.scale)} mm`,
      x + width + 2,
      top + height / 2,
      7,
      "#718275",
      { angle: 90 },
    );
    const details = [
      ["Material", sheet.material],
      ["Placed parts", stat.parts],
      ["Utilization", `${stat.utilization.toFixed(1)}%`],
      ["Stock area", `${stat.stockArea.toFixed(3)} m²`],
      ["Net part area", `${stat.usedArea.toFixed(3)} m²`],
      ["Remaining incl. kerf", `${stat.remainingArea.toFixed(3)} m²`],
      [
        "Stock grain",
        result.considerGrain ? `Along ${sheet.grain}` : "Not considered",
      ],
    ];
    details.forEach(([label, value], i) =>
      keyValue(label, value, 217, 53 + i * 17, 65),
    );
    if (result.considerGrain) {
      doc.setDrawColor("#145b4c");
      doc.setLineWidth(0.5);
      const gx = x + width / 2,
        gy = 187;
      if (sheet.grain === "width") {
        doc.line(gx - 10, gy, gx + 10, gy);
        doc.line(gx + 10, gy, gx + 7, gy - 2);
      } else {
        doc.line(gx, gy - 3, gx, gy + 3);
        doc.line(gx, gy + 3, gx - 2, gy);
      }
      text(`Grain along entered ${sheet.grain}`, gx + 15, gy + 1, 7, "#145b4c");
    }
  });

  let lineY;
  const appendixPage = () => {
    doc.addPage();
    header(
      "Part quantities & unplaced pieces",
      "Part numbers match the diagrams. Placed dimensions may be rotated; sizes below are the original inputs.",
    );
    const cols = [
      "#",
      "Part / material",
      "Width × length (mm)",
      "Requested",
      "Placed",
      "Unplaced",
      "Grain",
    ];
    [14, 24, 112, 170, 198, 224, 250].forEach((x, i) =>
      text(cols[i], x, 49, 8, "#718275"),
    );
    lineY = 58;
  };
  appendixPage();
  const placedCounts = new Map();
  for (const s of result.sheets)
    for (const p of s.placements)
      placedCounts.set(p.partId, (placedCounts.get(p.partId) || 0) + 1);
  project.parts.forEach((p, i) => {
    if (lineY > 184) appendixPage();
    const placed = placedCounts.get(p.id) || 0;
    const cells = [
      i + 1,
      fit(`${p.label} / ${p.material || "Plywood"}`, 82, 8),
      `${p.width} × ${p.height}`,
      p.qty,
      placed,
      Number(p.qty) - placed,
      result.considerGrain ? p.grain || "length" : "off",
    ];
    [14, 24, 112, 170, 198, 224, 250].forEach((x, j) =>
      text(cells[j], x, lineY, 8),
    );
    doc.setDrawColor("#e8ebe9");
    doc.setLineWidth(0.15);
    doc.line(14, lineY + 3, 283, lineY + 3);
    lineY += 8;
  });
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    text(
      "Heuristic layout · Not to physical scale · Verify dimensions, grain and cut sequence before cutting.",
      14,
      201,
      7,
      "#718275",
    );
    text(`${page} / ${total}`, 283, 201, 8, "#718275", { align: "right" });
  }
  return doc;
}
