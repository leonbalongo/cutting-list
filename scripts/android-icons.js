import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Legacy launchers on Android 7 use density-specific PNGs. Android 8+ uses
// the original vector mark in an adaptive icon (see android/app/src/main/res).
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  await mkdir(dir, { recursive: true });
  for (const name of ["ic_launcher", "ic_launcher_round"]) {
    await sharp("public/icon.svg")
      .resize(size, size)
      .png()
      .toFile(`${dir}/${name}.png`);
  }
}
console.log("Cutcraft Android launcher icons generated.");
