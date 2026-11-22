import test from "node:test";
import assert from "node:assert/strict";
import { optimize, normalize } from "../src/optimizer.js";
const part = (width, height, qty = 1, extra = {}) => ({
  id: "p1",
  label: "Test part",
  width,
  height,
  qty,
  material: "Plywood",
  rotate: true,
  ...extra,
});
const stock = (width, height, qty = "", extra = {}) => ({
  id: "s1",
  label: "Stock",
  width,
  height,
  qty,
  material: "Plywood",
  ...extra,
});
const input = (parts, stocks = [stock(100, 100)], extra = {}) => ({
  parts,
  stocks,
  kerf: 0,
  trim: 0,
  rotation: true,
  quality: "balanced",
  ...extra,
});
function verify(result, request) {
  const data = normalize(request),
    seen = new Set(),
    inventory = new Map();
  for (const sheet of result.sheets) {
    const s = data.stocks.find((s) => s.id === sheet.stockId);
    assert.ok(s);
    inventory.set(s.id, (inventory.get(s.id) || 0) + 1);
    assert.ok(inventory.get(s.id) <= s.qty);
    assert.equal(sheet.w, s.w);
    assert.equal(sheet.h, s.h);
    for (const [i, p] of sheet.placements.entries()) {
      const source = data.parts.find((part) => part.id === p.partId);
      assert.ok(source);
      assert.equal(source.material, sheet.material);
      assert.ok(p.instance > 0 && p.instance <= source.qty);
      const key = `${p.partId}/${p.instance}`;
      assert.ok(!seen.has(key));
      seen.add(key);
      assert.equal(p.w, p.rotated ? source.h : source.w);
      assert.equal(p.h, p.rotated ? source.w : source.h);
      if (!source.rotate) assert.equal(p.rotated, false);
      for (const v of [p.x, p.y, p.w, p.h]) assert.ok(Number.isSafeInteger(v));
      assert.ok(p.x >= data.trim && p.y >= data.trim);
      assert.ok(p.x + p.w <= sheet.w - data.trim);
      assert.ok(p.y + p.h <= sheet.h - data.trim);
      for (const other of sheet.placements.slice(i + 1)) {
        assert.ok(
          p.x + p.w + data.kerf <= other.x ||
            other.x + other.w + data.kerf <= p.x ||
            p.y + p.h + data.kerf <= other.y ||
            other.y + other.h + data.kerf <= p.y,
          "parts overlap or violate saw kerf",
        );
      }
    }
  }
  for (const p of result.unplaced) {
    const key = `${p.partId}/${p.instance}`;
    assert.ok(!seen.has(key));
    seen.add(key);
  }
  assert.equal(
    seen.size,
    data.parts.reduce((s, p) => s + p.qty, 0),
  );
  assert.ok(result.utilization >= 0 && result.utilization <= 100);
}
test("packs a known optimum with exact dimensions", () => {
  const req = input([part(50, 50, 4)]),
    r = optimize(req);
  verify(r, req);
  assert.equal(r.sheets.length, 1);
  assert.equal(r.utilization, 100);
  assert.equal(r.unplaced.length, 0);
});
test("saw kerf changes required sheet count", () => {
  const req = input([part(50, 50, 4)], undefined, { kerf: 3 });
  const r = optimize(req);
  verify(r, req);
  assert.equal(r.sheets.length, 4);
});
test("kerf plus four-edge trim packs exact decimal sizes", () => {
  const req = input([part("48.375", "48.375", 4)], undefined, {
    kerf: "1.250",
    trim: 1,
  });
  const r = optimize(req);
  verify(r, req);
  assert.equal(r.sheets.length, 1);
});
test("permits exact sheet fits without charging kerf at the outer edge", () => {
  const req = input([part(100, 100)], undefined, { kerf: 4 });
  const r = optimize(req);
  verify(r, req);
  assert.equal(r.unplaced.length, 0);
});
test("rotation and grain locks are respected", () => {
  let req = input([part(80, 40)], [stock(40, 80)]);
  let r = optimize(req);
  verify(r, req);
  assert.equal(r.sheets[0].placements[0].rotated, true);
  for (const locked of [
    { rotation: false },
    { parts: [part(80, 40, 1, { rotate: false })] },
  ]) {
    req = { ...req, ...locked };
    r = optimize(req);
    verify(r, req);
    assert.equal(r.unplaced.length, 1);
  }
});
test("material matches and finite inventories are enforced", () => {
  const req = input(
    [part(100, 100, 2), part(100, 100, 1, { id: "p2", material: "MDF" })],
    [stock(100, 100, 1), stock(100, 100, 1, { id: "s2", material: "MDF" })],
  );
  const r = optimize(req);
  verify(r, req);
  assert.equal(r.sheets.length, 2);
  assert.equal(r.unplaced.length, 1);
});
test("does not silently discard oversized or unavailable-material parts", () => {
  const req = input([
    part(101, 101),
    part(20, 20, 1, { id: "p2", material: "Oak" }),
  ]);
  const r = optimize(req);
  verify(r, req);
  assert.equal(r.unplaced.length, 2);
});
test("rejects invalid dimensions, fractions, expressions and quantities", () => {
  for (const value of [
    "1/0",
    "2+3",
    "Infinity",
    "12abc",
    "1.0001",
    0,
    -1,
    NaN,
    Infinity,
    "",
  ])
    assert.throws(
      () => optimize(input([part(value, 10)])),
      /dimension|number|positive/,
    );
  for (const value of [0, -1, 1.5, "2x", Infinity])
    assert.throws(() => optimize(input([part(10, 10, value)])), /whole number/);
  assert.throws(
    () => optimize(input([part(1, 1)], undefined, { trim: 50 })),
    /no usable area/,
  );
  assert.throws(() => optimize(input([])), /at least one part/);
  assert.throws(() => optimize(input([part(1, 1)], [])), /stock sheet/);
});
test("reports progress and is deterministic", () => {
  const req = input([part(34, 27, 12)]);
  const progress = [];
  const a = optimize(req, (p) => progress.push(p)),
    b = optimize(req);
  assert.deepEqual(a.sheets, b.sheets);
  assert.equal(progress.length, 12);
  assert.equal(progress.at(-1), 100);
});
test("thorough includes balanced trials and never makes the objective worse", () => {
  const req = input([
    part(25, 40, 3),
    part(35, 20, 5, { id: "p2" }),
    part(60, 30, 2, { id: "p3" }),
  ]);
  const a = optimize(req),
    b = optimize({ ...req, quality: "thorough" });
  verify(b, req);
  assert.ok(b.unplaced.length <= a.unplaced.length);
  if (b.unplaced.length === a.unplaced.length)
    assert.ok(b.stockArea <= a.stockArea);
});
test("no imposed quota: packs over a thousand parts", () => {
  const req = input([part(10, 10, 1200)], [stock(100, 100)], {
    quality: "quick",
  });
  const r = optimize(req);
  verify(r, req);
  assert.equal(r.unplaced.length, 0);
  assert.equal(r.sheets.length, 12);
});
test("randomized geometry invariants across 80 projects", () => {
  let seed = 42;
  const rand = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let i = 0; i < 80; i++) {
    const req = input(
      Array.from({ length: 5 }, (_, j) =>
        part(5 + rand(120), 5 + rand(120), 1 + rand(5), {
          id: `p${j}`,
          rotate: Boolean(rand(2)),
          material: rand(3) ? "Plywood" : "MDF",
        }),
      ),
      [
        stock(150, 100, 1 + rand(6)),
        stock(120, 180, "", { id: "s2", material: "MDF" }),
      ],
      {
        kerf: rand(5) / 2,
        trim: rand(4),
        quality: i % 2 ? "balanced" : "thorough",
      },
    );
    verify(optimize(req), req);
  }
});

test("rejects duplicate row IDs to prevent incorrect stock inventory tracking", () => {
  assert.throws(
    () => optimize(input([part(10, 10)], [stock(100, 100), stock(100, 100)])),
    /unique ID/,
  );
  assert.throws(
    () => optimize(input([part(10, 10), part(20, 20)])),
    /unique ID/,
  );
});

test("does not silently round JSON numeric inputs past supported precision", () => {
  assert.throws(() => optimize(input([part(1.0001, 10)])), /3 decimal/);
});
