/*
 * gen-brand-assets.cjs — regenerates the per-app raster brand ladder from the
 * canonical SVG masters in packages/presentation/src/assets/brand/.
 * ──────────────────────────────────────────────────────────────────────────
 * Masters:
 *   favicon.svg   — bare emblem, no background tile (browser-tab favicon)
 *   icon-mark.svg — the emblem as a white letterform on a cobalt rounded
 *                   tile (apple-touch / social / app-icon source)
 *
 * Outputs (written into each app's public/):
 *   favicon.png          — from favicon.svg, per-app size (see APPS below)
 *   favicon.ico           — from favicon.svg, 16/32/48 multi-res
 *   apple-touch-icon.png — from icon-mark.svg, 180x180
 *
 * Resolves `sharp` from apps/admin's node_modules (a real dependency there,
 * required by Payload CMS) rather than adding a new package dependency.
 *
 * Usage:
 *   node scripts/gen-brand-assets.cjs
 */
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const BRAND_DIR = path.join(ROOT, 'packages/presentation/src/assets/brand');
const FAVICON_SVG = path.join(BRAND_DIR, 'favicon.svg');
const ICON_MARK_SVG = path.join(BRAND_DIR, 'icon-mark.svg');

const APPS = [
  { name: 'marketing', publicDir: path.join(ROOT, 'apps/marketing/public'), faviconPngSize: 64 },
  { name: 'docs', publicDir: path.join(ROOT, 'apps/docs/public'), faviconPngSize: 32 },
  { name: 'admin', publicDir: path.join(ROOT, 'apps/admin/public'), faviconPngSize: 32 },
];

const APPLE_TOUCH_ICON_SIZE = 180;
const ICO_SIZES = [16, 32, 48];

function resolveSharp() {
  const searchRoots = [path.join(ROOT, 'apps/admin'), ROOT];
  const sharpPath = require.resolve('sharp', { paths: searchRoots });
  return require(sharpPath);
}

/** Packs PNG buffers into a minimal ICO container (PNG-in-ICO, Vista+/all browsers). */
function packIco(entries) {
  const count = entries.length;
  const dir = Buffer.alloc(6 + count * 16);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(count, 4);

  let offset = dir.length;
  const chunks = [dir];
  entries.forEach((entry, i) => {
    const entryOffset = 6 + i * 16;
    const sizeByte = entry.size >= 256 ? 0 : entry.size;
    dir.writeUInt8(sizeByte, entryOffset); // width
    dir.writeUInt8(sizeByte, entryOffset + 1); // height
    dir.writeUInt8(0, entryOffset + 2); // color count (0 = no palette)
    dir.writeUInt8(0, entryOffset + 3); // reserved
    dir.writeUInt16LE(1, entryOffset + 4); // color planes
    dir.writeUInt16LE(32, entryOffset + 6); // bits per pixel
    dir.writeUInt32LE(entry.png.length, entryOffset + 8); // size in bytes
    dir.writeUInt32LE(offset, entryOffset + 12); // offset
    offset += entry.png.length;
    chunks.push(entry.png);
  });

  return Buffer.concat(chunks);
}

async function main() {
  const sharp = resolveSharp();

  for (const app of APPS) {
    if (!fs.existsSync(app.publicDir)) {
      console.error(`skip ${app.name}: no public dir at ${app.publicDir}`);
      continue;
    }

    const faviconPng = await sharp(FAVICON_SVG)
      .resize(app.faviconPngSize, app.faviconPngSize)
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(app.publicDir, 'favicon.png'), faviconPng);

    const icoEntries = [];
    for (const size of ICO_SIZES) {
      const png = await sharp(FAVICON_SVG).resize(size, size).png().toBuffer();
      icoEntries.push({ size, png });
    }
    fs.writeFileSync(path.join(app.publicDir, 'favicon.ico'), packIco(icoEntries));

    const appleTouchPng = await sharp(ICON_MARK_SVG)
      .resize(APPLE_TOUCH_ICON_SIZE, APPLE_TOUCH_ICON_SIZE)
      .flatten({ background: '#003d94' })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(app.publicDir, 'apple-touch-icon.png'), appleTouchPng);

    console.log(`${app.name}: favicon.png (${app.faviconPngSize}), favicon.ico (16/32/48), apple-touch-icon.png (180)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
