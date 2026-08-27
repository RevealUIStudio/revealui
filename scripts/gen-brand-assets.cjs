/*
 * gen-brand-assets.cjs — regenerates the per-app brand ladder from the
 * canonical SVG masters in packages/presentation/src/assets/brand/.
 * ──────────────────────────────────────────────────────────────────────────
 * Masters read:
 *   revealui-logo.svg  — the only Circuit-R master (navy fills, frost traces,
 *                        amber vias). Public chrome copies this file.
 *   favicon.svg        — flat 3-path extract, no traces (browser-tab favicon)
 *
 * Derived in this script (same letterform, never a second R):
 *   icon-mark.svg      — master on a #060d1a rounded plate (rx=112), scale
 *                        0.742 (70% of the overshooting 1.06 master) so a
 *                        circular crop does not clip the stem or leg tip.
 *   icon-maskable.svg  — the same plate full-bleed (rx=0) for PWA masking.
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
 * and NavBar's <img src="/revealui-logo.svg"> read the app-local copies,
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
const MASTER_SVG = path.join(BRAND_DIR, 'revealui-logo.svg');
const FAVICON_SVG = path.join(BRAND_DIR, 'favicon.svg');
const ICON_MARK_SVG = path.join(BRAND_DIR, 'icon-mark.svg');
const ICON_MASKABLE_SVG = path.join(BRAND_DIR, 'icon-maskable.svg');

/** Locked transform on revealui-logo.svg. Do not steepen the letter. */
const MASTER_SCALE = 'scale(1.06)';
/** 70% of the overshooting master so a circular crop keeps stem + leg tip. */
const TILE_SCALE = 'scale(0.742)';

const APPS = [
  { name: 'marketing', publicDir: path.join(ROOT, 'apps/marketing/public'), faviconPngSize: 64 },
  { name: 'docs', publicDir: path.join(ROOT, 'apps/docs/public'), faviconPngSize: 32 },
  { name: 'admin', publicDir: path.join(ROOT, 'apps/admin/public'), faviconPngSize: 32 },
];

/** SVG masters each app serves directly from its public/ root. */
const SVG_SYNC = {
  marketing: ['favicon.svg', 'icon-mark.svg', 'revealui-logo.svg'],
  docs: ['favicon.svg', 'revealui-logo.svg'],
  admin: ['favicon.svg', 'revealui-logo.svg'],
};

const APPLE_TOUCH_ICON_SIZE = 180;
const ICO_SIZES = [16, 32, 48];
const PWA_SIZES = [192, 512];
const MASKABLE_SIZE = 512;
const TILE_BG = '#060d1a';

/**
 * Wrap the circuit master on a navy plate and shrink it so GitHub / apple-touch
 * / PWA circular crops do not clip the stem or the leg tip.
 * Literal scale swap — not a redraw, not a second letter.
 */
function deriveNavyPlate(masterSvg, rx) {
  const scaleAt = masterSvg.indexOf(MASTER_SCALE);
  if (scaleAt === -1) {
    throw new Error('revealui-logo.svg is missing the locked scale(1.06) transform');
  }
  const inset =
    masterSvg.slice(0, scaleAt) + TILE_SCALE + masterSvg.slice(scaleAt + MASTER_SCALE.length);
  const svgGt = inset.indexOf('>');
  if (svgGt === -1) {
    throw new Error('revealui-logo.svg is missing the root <svg> tag');
  }
  const plate = `<rect width="512" height="512" rx="${rx}" fill="${TILE_BG}"></rect>`;
  return inset.slice(0, svgGt + 1) + plate + inset.slice(svgGt + 1);
}

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

  for (const master of [MASTER_SVG, FAVICON_SVG]) {
    if (!fs.existsSync(master)) {
      console.error(`missing master: ${master}`);
      process.exit(1);
    }
  }

  const circuitMaster = fs.readFileSync(MASTER_SVG, 'utf8');
  fs.writeFileSync(ICON_MARK_SVG, deriveNavyPlate(circuitMaster, 112));
  fs.writeFileSync(ICON_MASKABLE_SVG, deriveNavyPlate(circuitMaster, 0));

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

    for (const retired of ['revealui-logo-dark.svg']) {
      const retiredPath = path.join(app.publicDir, retired);
      if (fs.existsSync(retiredPath)) {
        fs.unlinkSync(retiredPath);
      }
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
