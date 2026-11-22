// Independent guillotine nesting heuristic. All geometry uses integer thousandths
// of a millimetre; rounding happens at the input boundary, never during packing.
export const SCALE = 1000;
const dimension = (value, label, allowZero = false) => {
  if (typeof value === "string" && !/^\d+(?:\.\d{1,3})?$/.test(value.trim()))
    throw new Error(`${label}: use a number with up to 3 decimal places.`);
  if (!["string", "number"].includes(typeof value))
    throw new Error(`${label} must be a number.`);
  const n = Number(value);
  const scaled = Math.round(n * SCALE);
  if (Number.isFinite(n) && Math.abs(scaled - n * SCALE) > 0.000001)
    throw new Error(`${label}: use up to 3 decimal places.`);
  if (
    !Number.isFinite(n) ||
    !Number.isSafeInteger(scaled) ||
    (allowZero ? n < 0 : n <= 0) ||
    (!allowZero && scaled === 0)
  )
    throw new Error(
      `${label} must be ${allowZero ? "zero or " : ""}a positive, finite dimension.`,
    );
  return scaled;
};
const quantity = (v, label) => {
  if (
    !/^\d+$/.test(String(v)) ||
    !Number.isSafeInteger(Number(v)) ||
    Number(v) < 1
  )
    throw new Error(`${label} must be a positive whole number.`);
  return Number(v);
};

export function normalize(input) {
  const kerf = dimension(input.kerf, "Saw kerf", true);
  const trim = dimension(input.trim, "Edge trim", true);
  if (!input.parts?.length)
    throw new Error("Add at least one part to optimize.");
  if (!input.stocks?.length) throw new Error("Add at least one stock sheet.");
  const parts = input.parts.map((p, i) => ({
    ...p,
    id: p.id || `part-${i}`,
    material: (p.material || "Plywood").trim(),
    w: dimension(p.width, `Part ${i + 1} width`),
    h: dimension(p.height, `Part ${i + 1} length`),
    qty: quantity(p.qty, `Part ${i + 1} quantity`),
    rotate: p.rotate !== false && input.rotation !== false,
  }));
  const stocks = input.stocks.map((s, i) => ({
    ...s,
    id: s.id || `stock-${i}`,
    material: (s.material || "Plywood").trim(),
    w: dimension(s.width, `Stock ${i + 1} width`),
    h: dimension(s.height, `Stock ${i + 1} length`),
    qty:
      s.qty === "" || s.qty === null
        ? Infinity
        : quantity(s.qty, `Stock ${i + 1} quantity`),
  }));
  if (
    new Set(parts.map((p) => p.id)).size !== parts.length ||
    new Set(stocks.map((s) => s.id)).size !== stocks.length
  )
    throw new Error("Each part and stock row must have a unique ID.");
  for (const s of stocks)
    if (s.w <= trim * 2 || s.h <= trim * 2)
      throw new Error("Edge trim leaves no usable area on a stock sheet.");
  return { parts, stocks, kerf, trim };
}

function variants(part) {
  return part.rotate && part.w !== part.h
    ? [
        [part.w, part.h, false],
        [part.h, part.w, true],
      ]
    : [[part.w, part.h, false]];
}

function findPosition(sheet, part, strategy) {
  if (sheet.material !== part.material) return null;
  let best = null;
  for (let i = 0; i < sheet.free.length; i++) {
    const r = sheet.free[i];
    for (const [w, h, rotated] of variants(part)) {
      if (w > r.w || h > r.h) continue;
      const dw = r.w - w,
        dh = r.h - h;
      const score =
        strategy === 0
          ? Math.min(dw, dh) * 1e5 + Math.max(dw, dh)
          : strategy === 1
            ? r.w * r.h - w * h
            : r.y * 1e5 + r.x;
      if (!best || score < best.score)
        best = { index: i, w, h, rotated, score };
    }
  }
  return best;
}

function place(sheet, part, pos, kerf, split) {
  const r = sheet.free.splice(pos.index, 1)[0];
  const dw = r.w - pos.w - kerf,
    dh = r.h - pos.h - kerf;
  // The removed saw-width strip is only needed where there is a remainder.
  // Both partitions are guillotine cuts and cannot create overlapping free space.
  const vertical = split === 0 ? dw > dh : split === 1 ? dw <= dh : r.w > r.h;
  if (vertical) {
    if (dw > 0)
      sheet.free.push({ x: r.x + pos.w + kerf, y: r.y, w: dw, h: r.h });
    if (dh > 0)
      sheet.free.push({ x: r.x, y: r.y + pos.h + kerf, w: pos.w, h: dh });
  } else {
    if (dh > 0)
      sheet.free.push({ x: r.x, y: r.y + pos.h + kerf, w: r.w, h: dh });
    if (dw > 0)
      sheet.free.push({ x: r.x + pos.w + kerf, y: r.y, w: dw, h: pos.h });
  }
  sheet.placements.push({
    partId: part.id,
    instance: part.instance,
    label: part.label,
    color: part.color,
    x: r.x,
    y: r.y,
    w: pos.w,
    h: pos.h,
    rotated: pos.rotated,
  });
}

function attempt(data, order, strategy, split) {
  const items = [];
  for (const p of data.parts)
    for (let n = 0; n < p.qty; n++) items.push({ ...p, instance: n + 1 });
  const ranks = [
    (p) => p.w * p.h,
    (p) => Math.max(p.w, p.h),
    (p) => p.w + p.h,
    (p) => Math.min(p.w, p.h),
  ];
  items.sort(
    (a, b) => ranks[order](b) - ranks[order](a) || a.id.localeCompare(b.id),
  );
  const sheets = [],
    unplaced = [],
    used = new Map();
  for (const part of items) {
    let candidate = null;
    for (const sheet of sheets) {
      const pos = findPosition(sheet, part, strategy);
      if (pos && (!candidate || pos.score < candidate.pos.score))
        candidate = { sheet, pos };
    }
    if (!candidate) {
      const options = [];
      for (const stock of data.stocks) {
        if ((used.get(stock.id) || 0) >= stock.qty) continue;
        const sheet = {
          stockId: stock.id,
          material: stock.material,
          label: stock.label,
          w: stock.w,
          h: stock.h,
          placements: [],
          free: [
            {
              x: data.trim,
              y: data.trim,
              w: stock.w - data.trim * 2,
              h: stock.h - data.trim * 2,
            },
          ],
        };
        const pos = findPosition(sheet, part, strategy);
        if (pos) options.push({ sheet, pos });
      }
      options.sort((a, b) => a.sheet.w * a.sheet.h - b.sheet.w * b.sheet.h);
      if (!options.length) {
        unplaced.push({
          partId: part.id,
          label: part.label,
          instance: part.instance,
        });
        continue;
      }
      candidate = options[0];
      sheets.push(candidate.sheet);
      used.set(
        candidate.sheet.stockId,
        (used.get(candidate.sheet.stockId) || 0) + 1,
      );
    }
    place(candidate.sheet, part, candidate.pos, data.kerf, split);
  }
  const usedArea = sheets.reduce(
    (s, sh) => s + sh.placements.reduce((a, p) => a + p.w * p.h, 0),
    0,
  );
  const stockArea = sheets.reduce((s, sh) => s + sh.w * sh.h, 0);
  return {
    sheets,
    unplaced,
    usedArea,
    stockArea,
    utilization: stockArea ? (usedArea / stockArea) * 100 : 0,
    kerf: data.kerf,
    trim: data.trim,
    scale: SCALE,
  };
}

export function optimize(input, progress = () => {}) {
  const started = performance.now();
  const data = normalize(input);
  let best = null;
  const trials =
    input.quality === "thorough" ? 36 : input.quality === "quick" ? 4 : 12;
  for (let i = 0; i < trials; i++) {
    const result = attempt(
      data,
      i % 4,
      Math.floor(i / 4) % 3,
      Math.floor(i / 12),
    );
    if (
      !best ||
      result.unplaced.length < best.unplaced.length ||
      (result.unplaced.length === best.unplaced.length &&
        (result.stockArea < best.stockArea ||
          (result.stockArea === best.stockArea &&
            result.sheets.length < best.sheets.length)))
    )
      best = result;
    progress(Math.round(((i + 1) / trials) * 100));
  }
  return { ...best, duration: performance.now() - started, trials };
}
