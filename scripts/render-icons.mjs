import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "src/assets/icons/pencil.svg");
const sizes = [16, 32, 48, 128];

const svg = await readFile(src);
for (const size of sizes) {
  const out = resolve(root, `src/assets/icons/pencil-${size}.png`);
  await sharp(svg)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}
