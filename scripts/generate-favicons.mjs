// Generate browser and install icons from one font-independent vector master.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("public/brand/nestly-favicon-v3.svg", root));
const sizes = [16, 32, 48, 64, 180, 192, 512];
const images = new Map();
for (const size of sizes) {
  images.set(size, await sharp(source, { density: 768 }).resize(size, size).png().toBuffer());
}

for (const size of [16, 32, 64, 180, 192, 512]) {
  await writeFile(new URL(`public/brand/nestly-favicon-v3-${size}.png`, root), images.get(size));
}
await writeFile(new URL("app/icon.png", root), images.get(512));
await writeFile(new URL("app/apple-icon.png", root), images.get(180));

// ICO directory entries point to PNG payloads, one for each small browser size.
const icoSizes = [16, 32, 48];
const directory = Buffer.alloc(6 + icoSizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(icoSizes.length, 4);
let offset = directory.length;
icoSizes.forEach((size, index) => {
  const entry = 6 + index * 16;
  const png = images.get(size);
  directory[entry] = size;
  directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(new URL("app/favicon.ico", root), Buffer.concat([directory, ...icoSizes.map((size) => images.get(size))]));
