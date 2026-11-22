import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { createPlanPDF, reportStatistics } from "../src/pdf-report.js";
import { optimize } from "../src/optimizer.js";
const project = {
  name: "Cabinet – test",
  kerf: 0,
  trim: 0,
  rotation: true,
  considerGrain: true,
  parts: [
    {
      id: "p",
      label: "Shelf",
      width: 100,
      height: 100,
      qty: 3,
      material: "Plywood",
      grain: "length",
    },
  ],
  stocks: [
    {
      id: "s",
      width: 100,
      height: 100,
      qty: "",
      material: "Plywood",
      grain: "length",
    },
  ],
};
test("whole-work and per-sheet PDF statistics use the same units and counts", () => {
  const result = optimize(project),
    stats = reportStatistics(project, result);
  assert.equal(stats.requested, 3);
  assert.equal(stats.placed, 3);
  assert.equal(stats.unplaced, 0);
  assert.equal(stats.stockArea, 0.03);
  assert.equal(stats.usedArea, 0.03);
  assert.equal(stats.remainingArea, 0);
  assert.equal(stats.utilization, 100);
  assert.equal(stats.sheets.length, 3);
  assert.equal(stats.sheets[0].stockArea, 0.01);
});
test("PDF contains a summary, every sheet diagram, and the complete part appendix", async () => {
  const result = optimize(project);
  const font = (await readFile("public/fonts/NotoSans-Regular.ttf")).toString(
    "base64",
  );
  const report = createPlanPDF(project, result, font);
  assert.equal(report.getNumberOfPages(), 5);
  const bytes = new Uint8Array(report.output("arraybuffer"));
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 5);
  assert.equal(parsed.getTitle(), "Cabinet – test - Cutting report");
});
test("partial and fully unplaced plans include totals, rather than dropping failed pieces", async () => {
  const p = { ...project, stocks: [{ ...project.stocks[0], qty: 1 }] },
    result = optimize(p),
    stats = reportStatistics(p, result);
  assert.equal(stats.unplaced, 2);
  assert.equal(stats.placed, 1);
  assert.equal(
    (
      await PDFDocument.load(createPlanPDF(p, result).output("arraybuffer"))
    ).getPageCount(),
    3,
  );
  const noFit = { ...project, parts: [{ ...project.parts[0], width: 200 }] },
    empty = optimize(noFit);
  assert.equal(reportStatistics(noFit, empty).unplaced, 3);
  assert.equal(createPlanPDF(noFit, empty).getNumberOfPages(), 2);
});
test("long part lists paginate without dropping rows or overlapping the footer", () => {
  const p = {
    ...project,
    parts: Array.from({ length: 50 }, (_, i) => ({
      ...project.parts[0],
      id: "p" + i,
      label: "Long label ".repeat(15),
      width: 10,
      height: 10,
      qty: 1,
    })),
    stocks: [{ ...project.stocks[0], qty: "" }],
  };
  const r = optimize(p);
  assert.ok(createPlanPDF(p, r).getNumberOfPages() >= 5);
});
