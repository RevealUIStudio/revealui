/*
 * gen-brand-assets.cjs: regenerates the per-app brand ladder from the
 * canonical SVG masters in packages/presentation/src/assets/brand/.
 * ──────────────────────────────────────────────────────────────────────────
 * Masters read:
 *   revealui-logo.svg      : kit Circuit-R master (true alpha). Transform lock
 *                            translate(256,256) scale(1.06) translate(-310,-320).
 *                            Public chrome copies this file. No plate.
 *   revealui-logo-dark.svg : the same bytes as revealui-logo.svg. Path
 *                            compatibility only. Not a second letterform and
 *                            not a #060d1a plate.
 *   favicon.svg            : the same kit master bytes (browser-tab favicon)
 *   revealui-mark.svg      : the same kit master bytes
 *
 * Derived in this script (same letterform, never a second R, never a frost invert):
 *   icon-mark.svg      : ADAPTER-ONLY. Master on a #060d1a rounded plate
 *                        (rx=112), scale 0.742, so a circular crop does not
 *                        clip the stem or leg tip. Not the official mark.
 *   icon-maskable.svg  : ADAPTER-ONLY. The same plate full-bleed (rx=0) for
 *                        PWA masking. Mark stays inside the 80 percent safe
 *                        zone. Not the official mark.
 *
 * Outputs, per app public/:
 *   favicon.svg, icon-mark.svg  : verbatim SVG copies (see SVG_SYNC)
 *   favicon.png                 : 32 from the transparent master; 64 from icon-mark
 *   favicon.ico                 : transparent master, no plate
 *   apple-touch-icon.png        : iOS adapter only, navy plate from icon-mark.svg, 180
 *   icon-192.png, icon-512.png  : transparent master, PWA purpose "any"
 *   icon-maskable-192.png, icon-maskable-512.png
 *                               : from icon-maskable.svg, purpose "maskable"
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
const MASTER_DARK_SVG = path.join(BRAND_DIR, 'revealui-logo-dark.svg');
const FAVICON_SVG = path.join(BRAND_DIR, 'favicon.svg');
const MARK_SVG = path.join(BRAND_DIR, 'revealui-mark.svg');
const MASTER_TRANSFORM = 'translate(256,256) scale(1.06) translate(-310,-320)';
const NAVY_FILLS = ['#0a2c5a', '#002247', '#0e3468', '#9fc9ff', '#f0b519'];
const INVERT_FILLS = ['#164687', '#0d3169', '#1e57a8', '#e8f1ff', '#082448'];
const ICON_MARK_SVG = path.join(BRAND_DIR, 'icon-mark.svg');
const ICON_MASKABLE_SVG = path.join(BRAND_DIR, 'icon-maskable.svg');

/** Locked transform on revealui-logo.svg. Do not steepen the letter. */
/** Bowl counter uses mask#cm (userSpaceOnUse). Do not drop it. */

const APPS = [
  { name: 'marketing', publicDir: path.join(ROOT, 'apps/marketing/public'), faviconPngSize: 64 },
  { name: 'docs', publicDir: path.join(ROOT, 'apps/docs/public'), faviconPngSize: 32 },
  { name: 'admin', publicDir: path.join(ROOT, 'apps/admin/public'), faviconPngSize: 32 },
];

/** SVG masters each app serves directly from its public/ root. */
const SVG_SYNC = {
  marketing: ['favicon.svg', 'icon-mark.svg', 'revealui-logo.svg', 'revealui-logo-dark.svg'],
  docs: ['favicon.svg', 'revealui-logo.svg', 'revealui-logo-dark.svg'],
  admin: ['favicon.svg', 'revealui-logo.svg', 'revealui-logo-dark.svg'],
};

const APPLE_TOUCH_ICON_SIZE = 180;
/** Transparent fallback. No plate. */
const ICO_SIZES = [16, 32, 48];
const FLAT_PNG_SIZES = [32];
/** Plated adapter rasters. Not the purpose "any" icons. */
const PLATE_PNG_SIZES = [48, 64, 96, 128, 256];
/** Purpose "any". Transparent master, alpha preserved. */
const ANY_PNG_SIZES = [192, 512];
/** Purpose "maskable". Navy plate, separate files. Never combined with "any". */
const MASKABLE_SIZES = [192, 512];
const TILE_BG = '#060d1a';

function assertNavyCircuitRMaster(masterSvg) {
  if (!masterSvg.includes(MASTER_TRANSFORM)) {
    throw new Error('revealui-logo.svg is missing the locked origin translate(-310,-320) at scale(1.06)');
  }
  if (masterSvg.includes('<rect') || masterSvg.includes(TILE_BG)) {
    throw new Error(
      'revealui-logo.svg must stay true-alpha. A #060d1a plate is adapter-only (icon-mark / maskable / apple-touch).',
    );
  }
  if (!masterSvg.includes('mask="url(#cm)"') || !masterSvg.includes('maskUnits="userSpaceOnUse"')) {
    throw new Error('revealui-logo.svg is missing empty-bowl mask #cm');
  }
  if (!masterSvg.includes('overflow="hidden"') || !masterSvg.includes('style="overflow:hidden"')) {
    throw new Error(
      'revealui-logo.svg must clip the 1.06 scale group (overflow hidden) so the mark does not paint a scrollbar',
    );
  }
  for (const fill of NAVY_FILLS) {
    if (!masterSvg.includes(fill)) {
      throw new Error(`revealui-logo.svg is missing navy Circuit-R fill ${fill}`);
    }
  }
  for (const fill of INVERT_FILLS) {
    if (masterSvg.includes(fill)) {
      throw new Error(
        `revealui-logo.svg contains frost-invert fill ${fill}. Dark must copy the navy letter.`,
      );
    }
  }
}

function deriveDarkFromLight(masterSvg) {
  assertNavyCircuitRMaster(masterSvg);
  return masterSvg;
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

  if (!fs.existsSync(MASTER_SVG)) {
    console.error(`missing master: ${MASTER_SVG}`);
    process.exit(1);
  }

  const circuitMaster = fs.readFileSync(MASTER_SVG, 'utf8');
  assertNavyCircuitRMaster(circuitMaster);
  fs.writeFileSync(MASTER_DARK_SVG, deriveDarkFromLight(circuitMaster));
  fs.writeFileSync(FAVICON_SVG, circuitMaster);
  fs.writeFileSync(MARK_SVG, circuitMaster);
  // icon-mark.svg and icon-maskable.svg are locked ADAPTER files.
  // Do not rewrite them from the master. The tile uses translate(-300,-320)
  // at scale(0.742). A scale-only derive does not reproduce that file.
  if (!fs.existsSync(ICON_MARK_SVG) || !fs.existsSync(ICON_MASKABLE_SVG)) {
    throw new Error('missing locked adapter SVG (icon-mark.svg or icon-maskable.svg)');
  }

  for (const size of FLAT_PNG_SIZES) {
    const png = await rasterize(sharp, MASTER_SVG, size);
    fs.writeFileSync(path.join(BRAND_DIR, `favicon-${size}.png`), png);
  }
  for (const size of PLATE_PNG_SIZES) {
    const png = await rasterize(sharp, ICON_MARK_SVG, size, { flatten: true });
    fs.writeFileSync(path.join(BRAND_DIR, `icon-${size}.png`), png);
  }
  for (const size of ANY_PNG_SIZES) {
    const png = await rasterize(sharp, MASTER_SVG, size);
    fs.writeFileSync(path.join(BRAND_DIR, `icon-${size}.png`), png);
  }
  for (const size of MASKABLE_SIZES) {
    const png = await rasterize(sharp, ICON_MASKABLE_SVG, size);
    fs.writeFileSync(path.join(BRAND_DIR, `icon-maskable-${size}.png`), png);
  }
  const brandIco = [];
  for (const size of ICO_SIZES) {
    brandIco.push({ size, png: await rasterize(sharp, MASTER_SVG, size) });
  }
  fs.writeFileSync(path.join(BRAND_DIR, 'favicon.ico'), packIco(brandIco));
  // iOS adapter only. Navy plate. Not the official mark.
  fs.writeFileSync(
    path.join(BRAND_DIR, 'apple-touch-icon.png'),
    await rasterize(sharp, ICON_MARK_SVG, APPLE_TOUCH_ICON_SIZE, { flatten: true }),
  );
  for (const stale of ['favicon-48.png', 'favicon-64.png']) {
    const stalePath = path.join(BRAND_DIR, stale);
    if (fs.existsSync(stalePath)) fs.unlinkSync(stalePath);
  }
  console.log(
    `brand: favicon.svg and revealui-mark.svg (kit master bytes), ` +
      `revealui-logo-dark.svg (same bytes), favicon.ico (transparent, no plate), ` +
      `favicon-32.png, apple-touch-icon.png (iOS adapter, 180), ` +
      `icon-192/512.png (transparent any), icon-maskable-192/512.png`,
  );

  for (const app of APPS) {
    if (!fs.existsSync(app.publicDir)) {
      console.error(`skip ${app.name}: no public dir at ${app.publicDir}`);
      continue;
    }

    for (const svg of SVG_SYNC[app.name] ?? []) {
      fs.copyFileSync(path.join(BRAND_DIR, svg), path.join(app.publicDir, svg));
    }

    const faviconFromCircuit = app.faviconPngSize > 32;
    const faviconPng = await rasterize(
      sharp,
      faviconFromCircuit ? ICON_MARK_SVG : FAVICON_SVG,
      app.faviconPngSize,
      { flatten: faviconFromCircuit },
    );
    fs.writeFileSync(path.join(app.publicDir, 'favicon.png'), faviconPng);
    for (const size of FLAT_PNG_SIZES) {
      fs.copyFileSync(path.join(BRAND_DIR, `favicon-${size}.png`), path.join(app.publicDir, `favicon-${size}.png`));
    }
    for (const size of PLATE_PNG_SIZES) {
      fs.copyFileSync(path.join(BRAND_DIR, `icon-${size}.png`), path.join(app.publicDir, `icon-${size}.png`));
    }
    for (const size of ANY_PNG_SIZES) {
      fs.copyFileSync(path.join(BRAND_DIR, `icon-${size}.png`), path.join(app.publicDir, `icon-${size}.png`));
    }
    for (const size of MASKABLE_SIZES) {
      fs.copyFileSync(
        path.join(BRAND_DIR, `icon-maskable-${size}.png`),
        path.join(app.publicDir, `icon-maskable-${size}.png`),
      );
    }

    const icoEntries = [];
    for (const size of ICO_SIZES) {
      icoEntries.push({ size, png: await rasterize(sharp, MASTER_SVG, size) });
    }
    fs.writeFileSync(path.join(app.publicDir, 'favicon.ico'), packIco(icoEntries));
    for (const stale of ['favicon-48.png', 'favicon-64.png']) {
      const stalePath = path.join(app.publicDir, stale);
      if (fs.existsSync(stalePath)) fs.unlinkSync(stalePath);
    }

    // iOS adapter only. Navy plate. Not the official mark.
    const appleTouchPng = await rasterize(sharp, ICON_MARK_SVG, APPLE_TOUCH_ICON_SIZE, {
      flatten: true,
    });
    fs.writeFileSync(path.join(app.publicDir, 'apple-touch-icon.png'), appleTouchPng);

    const synced = (SVG_SYNC[app.name] ?? []).join(', ');
    console.log(
      `${app.name}: ${synced ? synced + ', ' : ''}favicon.png (${app.faviconPngSize}), ` +
        `favicon.ico (transparent, no plate), apple-touch-icon.png (iOS adapter, 180), ` +
        `icon-192/512.png (transparent any), icon-maskable-192/512.png`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
