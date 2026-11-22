// Grain axes refer to the dimensions as entered, not to the longer edge.
export function grainAxis(value, allowNone = true) {
  const axis = String(value ?? "length")
    .trim()
    .toLowerCase();
  if (axis === "length" || axis === "width" || (allowNone && axis === "none"))
    return axis;
  throw new Error(
    `Invalid grain direction: ${axis}. Use length, width${allowNone ? ", or none" : ""}.`,
  );
}
export const placedGrain = (axis, rotated) =>
  axis === "none"
    ? "none"
    : rotated
      ? axis === "length"
        ? "width"
        : "length"
      : axis;
export const grainMatches = (part, stock, rotated) =>
  part === "none" || placedGrain(part, rotated) === stock;
