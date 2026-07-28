/*
 * gen-brand-assets.cjs — regenerates the per-app brand ladder from the
 * canonical SVG masters in packages/presentation/src/assets/brand/.
 * ──────────────────────────────────────────────────────────────────────────
 * Masters read:
 *   favicon.svg        — bare emblem, no background tile (browser-tab favicon)
 *   icon-mark.svg      — emblem on a #060d1a rounded tile (rx=112).
 *                        Source for apple-touch, PWA "any" icons, nav mark.
 *   icon-maskable.svg  — the same tile full-bleed (rx=0) for PWA masking.
 *
 * Outputs, per app public/:
 *   favicon.svg, icon-mark.svg  — verbatim SVG copies (see SVG_SYNC)
 *   favicon.png                 — from favicon.svg, per-app size
 *   favicon.ico                 — from favicon.svg, 16/32/48 multi-res
 *   apple-touch-icon.png        — from icon-mark.svg, 180
 *   icon-192.png, icon-512.png  — from icon-mark.svg, PWA purpose "any"
 *   icon-maskable-512.png       — from icon-maskable.svg, purpose "maskable"
 *
 * Also refreshes icon-192.png / icon-512.png inside the brand dir itself,
 * which are tracked there as the canonical rasters.
 *
 * The SVG sync matters: marketing's <link rel="icon" type="image/svg+xml">
 * and NavBar/Footer's <img src="/icon-mark.svg"> read the app-local copies,
 * so before this script synced them a master edit shipped the old mark
 * alongside new rasters. Do not go back to copying these by hand.
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
const ICON_MASKABLE_SVG = path.join(BRAND_DIR, 'icon-maskable.svg');

const APPS = [
  { name: 'marketing', publicDir: path.join(ROOT, 'apps/marketing/public'), faviconPngSize: 64 },
  { name: 'docs', publicDir: path.join(ROOT, 'apps/docs/public'), faviconPngSize: 32 },
  { name: 'admin', publicDir: path.join(ROOT, 'apps/admin/public'), faviconPngSize: 32 },
];

/** SVG masters each app serves directly from its public/ root. */
const SVG_SYNC = {
  marketing: ['favicon.svg', 'icon-mark.svg'],
  docs: ['favicon.svg'],
  admin: ['favicon.svg'],
};

const APPLE_TOUCH_ICON_SIZE = 180;
const ICO_SIZES = [16, 32, 48];
const PWA_SIZES = [192, 512];
const MASKABLE_SIZE = 512;
const TILE_BG = '#060d1a';

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

async function rasterize(sharp, src, size, { flatten = false } = {}) {
  let pipeline = sharp(src).resize(size, size);
  if (flatten) pipeline = pipeline.flatten({ background: TILE_BG });
  return pipeline.png().toBuffer();
}

async function main() {
  const sharp = resolveSharp();

  for (const master of [FAVICON_SVG, ICON_MARK_SVG, ICON_MASKABLE_SVG]) {
    if (!fs.existsSync(master)) {
      console.error(`missing master: ${master}`);
      process.exit(1);
    }
  }

  // Canonical PWA rasters, kept beside the masters.
  for (const size of PWA_SIZES) {
    const png = await rasterize(sharp, ICON_MARK_SVG, size, { flatten: true });
    fs.writeFileSync(path.join(BRAND_DIR, `icon-${size}.png`), png);
  }
  console.log(`brand: icon-192.png, icon-512.png`);

  for (const app of APPS) {
    if (!fs.existsSync(app.publicDir)) {
      console.error(`skip ${app.name}: no public dir at ${app.publicDir}`);
      continue;
    }

    for (const svg of SVG_SYNC[app.name] ?? []) {
      fs.copyFileSync(path.join(BRAND_DIR, svg), path.join(app.publicDir, svg));
    }

    const faviconPng = await rasterize(sharp, FAVICON_SVG, app.faviconPngSize);
    fs.writeFileSync(path.join(app.publicDir, 'favicon.png'), faviconPng);

    const icoEntries = [];
    for (const size of ICO_SIZES) {
      const png = await rasterize(sharp, FAVICON_SVG, size);
      icoEntries.push({ size, png });
    }
    fs.writeFileSync(path.join(app.publicDir, 'favicon.ico'), packIco(icoEntries));

    const appleTouchPng = await rasterize(sharp, ICON_MARK_SVG, APPLE_TOUCH_ICON_SIZE, {
      flatten: true,
    });
    fs.writeFileSync(path.join(app.publicDir, 'apple-touch-icon.png'), appleTouchPng);

    for (const size of PWA_SIZES) {
      const png = await rasterize(sharp, ICON_MARK_SVG, size, { flatten: true });
      fs.writeFileSync(path.join(app.publicDir, `icon-${size}.png`), png);
    }

    const maskablePng = await rasterize(sharp, ICON_MASKABLE_SVG, MASKABLE_SIZE, {
      flatten: true,
    });
    fs.writeFileSync(path.join(app.publicDir, 'icon-maskable-512.png'), maskablePng);

    const synced = (SVG_SYNC[app.name] ?? []).join(', ');
    console.log(
      `${app.name}: ${synced ? synced + ', ' : ''}favicon.png (${app.faviconPngSize}), ` +
        `favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192/512.png, icon-maskable-512.png`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
