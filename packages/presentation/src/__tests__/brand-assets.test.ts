import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const brandDir = path.resolve(process.cwd(), 'src/assets/brand');

function readBrand(name: string): string {
  return readFileSync(path.join(brandDir, name), 'utf8');
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

const STEM = 'M172,150 Q207,159 242,150';
const BOWL = 'M242,150 L300,143';
const LEG = 'M219.6,335.1';
const FACETED_A = 'M26 50';
const FACETED_B = 'M34 11';
const NAVY_STEM = '#0a2c5a';
const NAVY_BOWL = '#002247';
const NAVY_LEG = '#0e3468';
const FROST_TRACE = '#9fc9ff';
const AMBER_VIA = '#f0b519';
const NAVY_PLATE = '#060d1a';
const TILE_SCALE = 'scale(0.742)';
const MASTER_SCALE = 'scale(1.06)';
const MASTER_TRANSFORM = 'translate(256,256) scale(1.06) translate(-310,-320)';
const KIT_MASTER_SHA256 = 'a94031503236900c7711cc3c9b766e584fc1079ff820a05a969e8cc1d7acfa33';
const PRODUCT_LOGO_PATHS = [
  'packages/presentation/src/assets/brand/revealui-logo.svg',
  'packages/presentation/src/assets/brand/revealui-logo-dark.svg',
  'apps/marketing/public/revealui-logo.svg',
  'apps/marketing/public/revealui-logo-dark.svg',
  'apps/admin/public/revealui-logo.svg',
  'apps/admin/public/revealui-logo-dark.svg',
  'apps/docs/public/revealui-logo.svg',
  'apps/docs/public/revealui-logo-dark.svg',
] as const;
const SCYTHE_CLIP = 'M219.6,335.1';
const SCYTHE_TIP = '488.0,484.0';

const INVERT_STEM = '#164687';
const INVERT_BOWL = '#0d3169';
const INVERT_LEG = '#1e57a8';
const INVERT_TRACE = '#e8f1ff';
const INVERT_HAIRLINE = '#082448';
const SURFACE_0_PLATE = '<rect width="512" height="512" fill="#060d1a"';

describe('Circuit-R brand family', () => {
  it('keeps the light Circuit-R master as the v2 scythe, optically placed', () => {
    const master = readBrand('revealui-logo.svg');
    expect(master.includes(MASTER_SCALE)).toBe(true);
    expect(master.includes(MASTER_TRANSFORM)).toBe(true);
    expect(master.includes(STEM)).toBe(true);
    expect(master.includes(BOWL)).toBe(true);
    expect(master.includes(LEG)).toBe(true);
    expect(master.includes(SCYTHE_CLIP)).toBe(true);
    expect(master.includes(SCYTHE_TIP)).toBe(true);
    expect(master.includes('translate(-330,-320)')).toBe(false);
    expect(master.includes('translate(-290,-320)')).toBe(false);
    expect(master.includes(NAVY_STEM)).toBe(true);
    expect(master.includes(NAVY_BOWL)).toBe(true);
    expect(master.includes(NAVY_LEG)).toBe(true);
    expect(master.includes(FROST_TRACE)).toBe(true);
    expect(master.includes(AMBER_VIA)).toBe(true);
    expect(master.includes('<circle')).toBe(true);
    expect(master.includes(FACETED_A)).toBe(false);
    expect(master.includes(FACETED_B)).toBe(false);
    expect(master.includes('fill="#dfeeff" fill-rule="evenodd"')).toBe(false);
    expect(master.includes('maskUnits="userSpaceOnUse"')).toBe(true);
    expect(master.includes('maskContentUnits="userSpaceOnUse"')).toBe(true);
    expect(master.includes('mask="url(#cm)"')).toBe(true);
    expect(master.includes('M238,192 C300,190 345,196 360,222')).toBe(true);
    expect(master.includes(SURFACE_0_PLATE)).toBe(false);
    expect(master.includes(INVERT_STEM)).toBe(false);
    expect(master.includes(INVERT_TRACE)).toBe(false);
    expect(master.includes('overflow="hidden"')).toBe(true);
    expect(master.includes('style="overflow:hidden"')).toBe(true);
  });

  it('keeps dark as the same transparent kit master bytes, not a plated invent', () => {
    expect(existsSync(path.join(brandDir, 'revealui-logo-dark.svg'))).toBe(true);
    const light = readBrand('revealui-logo.svg');
    const dark = readBrand('revealui-logo-dark.svg');
    expect(dark).toBe(light);
    expect(dark.includes(MASTER_TRANSFORM)).toBe(true);
    expect(dark.includes(MASTER_SCALE)).toBe(true);
    expect(dark.includes(TILE_SCALE)).toBe(false);
    expect(dark.includes(STEM)).toBe(true);
    expect(dark.includes(BOWL)).toBe(true);
    expect(dark.includes(LEG)).toBe(true);
    expect(dark.includes(SCYTHE_CLIP)).toBe(true);
    expect(dark.includes(SCYTHE_TIP)).toBe(true);
    expect(dark.includes('translate(-330,-320)')).toBe(false);
    expect(dark.includes('translate(-300,-320)')).toBe(false);
    expect(dark.includes('translate(-290,-320)')).toBe(false);
    expect(dark.includes(NAVY_STEM)).toBe(true);
    expect(dark.includes(NAVY_BOWL)).toBe(true);
    expect(dark.includes(NAVY_LEG)).toBe(true);
    expect(dark.includes(FROST_TRACE)).toBe(true);
    expect(dark.includes(AMBER_VIA)).toBe(true);
    expect(dark.includes(NAVY_PLATE)).toBe(false);
    expect(dark.includes(SURFACE_0_PLATE)).toBe(false);
    expect(dark.includes('<rect')).toBe(false);
    expect(dark.includes('<circle')).toBe(true);
    expect(dark.includes(INVERT_STEM)).toBe(false);
    expect(dark.includes(INVERT_BOWL)).toBe(false);
    expect(dark.includes(INVERT_LEG)).toBe(false);
    expect(dark.includes(INVERT_TRACE)).toBe(false);
    expect(dark.includes(INVERT_HAIRLINE)).toBe(false);
    expect(dark.includes(FACETED_A)).toBe(false);
    expect(dark.includes('fill="#dfeeff" fill-rule="evenodd"')).toBe(false);
    expect(dark.includes('maskUnits="userSpaceOnUse"')).toBe(true);
    expect(dark.includes('mask="url(#cm)"')).toBe(true);
    expect(dark.includes('M238,192 C300,190 345,196 360,222')).toBe(true);
    expect(dark.includes('overflow="hidden"')).toBe(true);
    expect(dark.includes('style="overflow:hidden"')).toBe(true);
  });

  it('byte-matches every public Circuit-R logo to the locked kit master', () => {
    const repoRoot = path.resolve(brandDir, '../../../../..');
    for (const relativePath of PRODUCT_LOGO_PATHS) {
      const filePath = path.join(repoRoot, relativePath);
      expect(existsSync(filePath), relativePath).toBe(true);
      expect(sha256File(filePath), relativePath).toBe(KIT_MASTER_SHA256);
    }
  });

  it('hashes every logo SVG to the kit master and allowlists plate adapters', () => {
    const repoRoot = path.resolve(brandDir, '../../../../..');
    const masterNames = new Set([
      'revealui-logo.svg',
      'revealui-logo-dark.svg',
      'favicon.svg',
      'revealui-mark.svg',
    ]);
    const adapterNames = new Set(['icon-mark.svg', 'icon-maskable.svg']);
    const roots = [
      'packages/presentation/src/assets/brand',
      'apps/marketing/public',
      'apps/docs/public',
      'apps/admin/public',
    ];
    const masters: string[] = [];
    const adapters: string[] = [];

    for (const relativeRoot of roots) {
      const files: string[] = [];
      collectSvgFiles(path.join(repoRoot, relativeRoot), files);
      for (const filePath of files) {
        const base = path.basename(filePath);
        if (adapterNames.has(base)) {
          adapters.push(filePath);
          expect(sha256File(filePath), filePath).not.toBe(KIT_MASTER_SHA256);
          const text = readFileSync(filePath, 'utf8');
          expect(text.includes(NAVY_PLATE), `${filePath} ADAPTER`).toBe(true);
          expect(text.includes('<rect'), `${filePath} ADAPTER`).toBe(true);
        } else if (masterNames.has(base)) {
          masters.push(filePath);
          expect(sha256File(filePath), filePath).toBe(KIT_MASTER_SHA256);
          const text = readFileSync(filePath, 'utf8');
          expect(text.includes(NAVY_PLATE), filePath).toBe(false);
          expect(text.includes('<rect'), filePath).toBe(false);
        }
      }
    }

    expect(masters).toHaveLength(13);
    expect(adapters).toHaveLength(3);
  });

  it('tiles the same circuit letter on a navy plate, inset for a circular crop', () => {
    const iconMark = readBrand('icon-mark.svg');
    const maskable = readBrand('icon-maskable.svg');
    const master = readBrand('revealui-logo.svg');

    for (const tiled of [iconMark, maskable]) {
      expect(tiled.includes(NAVY_PLATE)).toBe(true);
      expect(tiled.includes(TILE_SCALE)).toBe(true);
      expect(tiled.includes(MASTER_SCALE)).toBe(false);
      expect(tiled.includes(STEM)).toBe(true);
      expect(tiled.includes(BOWL)).toBe(true);
      expect(tiled.includes(LEG)).toBe(true);
      expect(tiled.includes(NAVY_STEM)).toBe(true);
      expect(tiled.includes(FROST_TRACE)).toBe(true);
      expect(tiled.includes(AMBER_VIA)).toBe(true);
      expect(tiled.includes('<circle')).toBe(true);
      expect(tiled.includes('#1e57a8')).toBe(false);
      expect(tiled.includes(FACETED_A)).toBe(false);
      expect(tiled.includes('mask="url(#cm)"')).toBe(true);
    }

    expect(iconMark.includes('rx="112"')).toBe(true);
    expect(maskable.includes('rx="0"')).toBe(true);
    expect(master.includes('<circle')).toBe(true);
  });

  it('keeps the mono mark on this R with currentColor', () => {
    const mono = readBrand('revealui-mark-mono.svg');
    expect(mono.includes(STEM)).toBe(true);
    expect(mono.includes(BOWL)).toBe(true);
    expect(mono.includes(LEG)).toBe(true);
    expect(mono.includes('currentColor')).toBe(true);
    expect(mono.includes('#003d94')).toBe(false);
    expect(mono.includes(FACETED_A)).toBe(false);
  });

  it('locks public chrome to the ≥48 floor, not a 96px nav box', () => {
    const readme = readFileSync(path.join(brandDir, 'README.md'), 'utf8');
    expect(readme.includes('locked 48×48 CSS box')).toBe(true);
    expect(readme.includes('Do not restore 96px in the header')).toBe(true);
    expect(readme.includes('locked 96×96 CSS box')).toBe(false);
    expect(readme.includes('Never render either file below 96px')).toBe(false);
  });

  it('keeps the favicon raster files and does not restore retired 48/64 twins', () => {
    expect(existsSync(path.join(brandDir, 'favicon-32.png'))).toBe(true);
    expect(existsSync(path.join(brandDir, 'favicon-48.png'))).toBe(false);
    expect(existsSync(path.join(brandDir, 'favicon-64.png'))).toBe(false);
    expect(existsSync(path.join(brandDir, 'icon-48.png'))).toBe(true);
    expect(existsSync(path.join(brandDir, 'icon-64.png'))).toBe(true);
    expect(existsSync(path.join(brandDir, 'icon-96.png'))).toBe(true);
  });

  it('keeps wordmarks on this R with outlined RevealUI type', () => {
    const light = readBrand('wordmark-light.svg');
    const dark = readBrand('wordmark-dark.svg');
    for (const wordmark of [light, dark]) {
      expect(wordmark.includes(STEM)).toBe(true);
      expect(wordmark.includes(BOWL)).toBe(true);
      expect(wordmark.includes(LEG)).toBe(true);
      expect(wordmark.includes(FACETED_A)).toBe(false);
      expect(wordmark.includes('<text')).toBe(false);
    }
    expect(light.includes(NAVY_STEM)).toBe(true);
    expect(light.includes(NAVY_BOWL)).toBe(true);
    expect(light.includes(NAVY_LEG)).toBe(true);
    expect(dark.includes(NAVY_STEM)).toBe(true);
    expect(dark.includes(NAVY_BOWL)).toBe(true);
    expect(dark.includes(NAVY_LEG)).toBe(true);
    expect(dark.includes(INVERT_STEM)).toBe(false);
    expect(dark.includes(INVERT_TRACE)).toBe(false);
  });
});

const LOGO_ICON_ROOTS = [
  'packages/presentation/src/assets/brand',
  'apps/marketing/public',
  'apps/docs/public',
  'apps/admin/public',
] as const;

function collectSvgFiles(dir: string, acc: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'docs-pro' ||
      entry.name === '.well-known'
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSvgFiles(full, acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.svg')) acc.push(full);
  }
}

describe('installed icons', () => {
  it('lists separate any and maskable icons plus the master favicon', () => {
    const repoRoot = path.resolve(brandDir, '../../../../..');
    const jsonManifests = [
      'apps/marketing/public/site.webmanifest',
      'apps/docs/public/site.webmanifest',
    ];
    for (const relativePath of jsonManifests) {
      const manifest = JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8')) as {
        icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
      };
      expect(JSON.stringify(manifest).includes('any maskable'), relativePath).toBe(false);
      assertIconList(manifest.icons, relativePath);
    }

    const adminManifest = readFileSync(
      path.join(repoRoot, 'apps/admin/src/app/manifest.ts'),
      'utf8',
    );
    expect(adminManifest.includes('any maskable')).toBe(false);
    expect(adminManifest.includes("src: '/icon-192.png'")).toBe(true);
    expect(adminManifest.includes("purpose: 'any'")).toBe(true);
    expect(adminManifest.includes("src: '/icon-maskable-192.png'")).toBe(true);
    expect(adminManifest.includes("src: '/icon-maskable-512.png'")).toBe(true);
    expect(adminManifest.includes("src: '/favicon.svg'")).toBe(true);
    expect(adminManifest.includes("sizes: 'any'")).toBe(true);
    expect(adminManifest.includes("type: 'image/svg+xml'")).toBe(true);
  });

  it('marks the SVG icon link sizes any and labels the iOS plate', () => {
    const repoRoot = path.resolve(brandDir, '../../../../..');
    const pages: Array<[string, string]> = [
      [
        'apps/marketing/index.html',
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg" sizes="any" />',
      ],
      [
        'apps/docs/index.html',
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg" sizes="any" />',
      ],
      [
        'apps/admin/src/app/(frontend)/layout.tsx',
        '<link href="/favicon.svg" rel="icon" type="image/svg+xml" sizes="any" />',
      ],
    ];
    for (const [relativePath, needle] of pages) {
      const text = readFileSync(path.join(repoRoot, relativePath), 'utf8');
      expect(text.includes(needle), relativePath).toBe(true);
      expect(text.includes('iOS adapter only'), relativePath).toBe(true);
    }
  });

  it('keeps transparent corners on purpose any icons', async () => {
    const repoRoot = path.resolve(brandDir, '../../../../..');
    const nodeRequire = createRequire(path.join(repoRoot, 'apps/admin/package.json'));
    const sharp = nodeRequire('sharp') as (input: string) => {
      ensureAlpha(): {
        raw(): {
          toBuffer(options: {
            resolveWithObject: true;
          }): Promise<{ data: Buffer; info: { width: number; height: number; channels: number } }>;
        };
      };
    };

    for (const relativeRoot of LOGO_ICON_ROOTS) {
      for (const name of ['icon-192.png', 'icon-512.png'] as const) {
        const filePath = path.join(repoRoot, relativeRoot, name);
        expect(existsSync(filePath), filePath).toBe(true);
        const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({
          resolveWithObject: true,
        });
        const expected = name === 'icon-192.png' ? 192 : 512;
        expect(info.width, filePath).toBe(expected);
        expect(info.height, filePath).toBe(expected);
        const corners = [
          [0, 0],
          [info.width - 1, 0],
          [0, info.height - 1],
          [info.width - 1, info.height - 1],
        ] as const;
        for (const [x, y] of corners) {
          const index = (y * info.width + x) * info.channels + (info.channels - 1);
          expect(data[index], `${filePath} ${x},${y}`).toBe(0);
        }
      }
    }
  });

  it('keeps a navy plate on maskable icons', async () => {
    const repoRoot = path.resolve(brandDir, '../../../../..');
    const nodeRequire = createRequire(path.join(repoRoot, 'apps/admin/package.json'));
    const sharp = nodeRequire('sharp') as (input: string) => {
      ensureAlpha(): {
        raw(): {
          toBuffer(options: {
            resolveWithObject: true;
          }): Promise<{ data: Buffer; info: { width: number; height: number; channels: number } }>;
        };
      };
    };

    for (const relativeRoot of LOGO_ICON_ROOTS) {
      for (const name of ['icon-maskable-192.png', 'icon-maskable-512.png'] as const) {
        const filePath = path.join(repoRoot, relativeRoot, name);
        expect(existsSync(filePath), filePath).toBe(true);
        const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({
          resolveWithObject: true,
        });
        const corners = [
          [0, 0],
          [info.width - 1, 0],
          [0, info.height - 1],
          [info.width - 1, info.height - 1],
        ] as const;
        for (const [x, y] of corners) {
          const index = (y * info.width + x) * info.channels;
          expect(data[index], `${filePath} ${x},${y} r`).toBe(6);
          expect(data[index + 1], `${filePath} ${x},${y} g`).toBe(13);
          expect(data[index + 2], `${filePath} ${x},${y} b`).toBe(26);
          expect(data[index + 3], `${filePath} ${x},${y} a`).toBe(255);
        }
      }
    }
  });

  it('keeps official kit PNGs byte for byte on marketing and admin', () => {
    const repoRoot = path.resolve(brandDir, '../../../../..');
    const officialRoots = ['apps/marketing/public', 'apps/admin/public'] as const;
    const officialSha256 = {
      'icon-192.png': '062e96dfe37edd9c6f1d03af43af6a35fc1d9158a9444e96faa4c426ffcadfe7',
      'icon-512.png': '3614b9ced42fb4d51678ef8c19a603782dd95650df81f18f884d56ab7e45d090',
      'icon-maskable-192.png': '99a3e0057e0f6d61678d8f4fbe1b490b6d2d1e542e3f094fc8b43096178bea8a',
      'icon-maskable-512.png': '357040fd617c8f366485b37ce3514f152c734b594f47f077064b1973a05e9074',
    } as const;
    for (const relativeRoot of officialRoots) {
      for (const name of Object.keys(officialSha256) as Array<keyof typeof officialSha256>) {
        const filePath = path.join(repoRoot, relativeRoot, name);
        expect(sha256File(filePath), filePath).toBe(officialSha256[name]);
      }
    }
  });
});

function assertIconList(
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>,
  label: string,
): void {
  const bySrc = new Map(icons.map((icon) => [icon.src, icon]));
  expect(bySrc.get('/icon-192.png'), label).toMatchObject({
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any',
  });
  expect(bySrc.get('/icon-512.png'), label).toMatchObject({
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any',
  });
  expect(bySrc.get('/icon-maskable-192.png'), label).toMatchObject({
    sizes: '192x192',
    type: 'image/png',
    purpose: 'maskable',
  });
  expect(bySrc.get('/icon-maskable-512.png'), label).toMatchObject({
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  });
  expect(bySrc.get('/favicon.svg'), label).toMatchObject({
    sizes: 'any',
    type: 'image/svg+xml',
    purpose: 'any',
  });
  for (const icon of icons) {
    expect(icon.purpose === 'any' || icon.purpose === 'maskable', label).toBe(true);
  }
}
