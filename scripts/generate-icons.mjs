import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
const svg = await readFile(new URL("../public/icon.svg", import.meta.url));
const folder = new URL("../public/icons/", import.meta.url);
await mkdir(folder, { recursive: true });
for (const [name, size] of [["icon-192", 192], ["icon-512", 512], ["apple-touch-icon", 180], ["maskable-512", 512]]) {
  await sharp(svg).resize(size, size).png().toFile(new URL(`${name}.png`, folder).pathname.replace(/^\/(?=[A-Z]:)/i, ""));
}
