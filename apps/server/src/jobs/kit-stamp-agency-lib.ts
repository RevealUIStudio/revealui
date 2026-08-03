/**
 * Pure helpers for Agency Founding Kit stamp job (GAP-448 Phase 2).
 * No DB / logger imports — unit-tested in isolation.
 */

export type KitArtifactMode = 'thin' | 'full';

export interface KitBranding {
  company: string;
  slug: string;
  brand: string;
  email: string;
}

export interface ThinKitPackage {
  version: 1;
  product: 'agency-founding-kit';
  tier: 'max';
  perpetual: true;
  maxSites: 10;
  branding: KitBranding;
  licenseId: string;
  customerId: string;
  startHere: string;
  revforgeConfig: {
    company: string;
    slug: string;
    email: string;
    brand: string;
    licenseTier: 'max';
    licensePerpetual: true;
  };
}

/** Resolve stamp mode from env (owner-ruled: P2-A thin first). */
export function resolveKitStampMode(env: NodeJS.ProcessEnv = process.env): KitArtifactMode {
  const raw = (env.REVEALUI_KIT_STAMP_MODE ?? 'thin').trim().toLowerCase();
  return raw === 'full' ? 'full' : 'thin';
}

/**
 * Normalize buyer branding with safe defaults (no founder required).
 * Slug must match RevForge ^[a-z0-9][a-z0-9-]*$.
 */
export function resolveKitBranding(input: {
  branding?: Partial<KitBranding>;
  buyerEmail?: string | null;
  customerId: string;
}): KitBranding {
  const email =
    input.branding?.email?.trim() ||
    input.buyerEmail?.trim() ||
    `buyer+${input.customerId.slice(0, 12)}@example.invalid`;
  const local = email.split('@')[0] ?? 'buyer';
  const slugFromEmail = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const slug = (
    input.branding?.slug
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') ||
    slugFromEmail ||
    `agency-${input.customerId.slice(0, 8).toLowerCase()}`
  ).replace(/^[^a-z0-9]+/, 'a');
  const company =
    input.branding?.company?.trim() ||
    local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Agency Customer';
  const brand = input.branding?.brand?.trim() || '#1a56db';
  return { company, slug: slug || 'agency-buyer', brand, email };
}

/** Build P2-A thin package (pure; no I/O). */
export function buildThinKitPackage(args: {
  branding: KitBranding;
  licenseId: string;
  customerId: string;
}): ThinKitPackage {
  const { branding, licenseId, customerId } = args;
  const startHere = [
    '# Agency Founding Kit',
    '',
    `Company: ${branding.company}`,
    `Slug: ${branding.slug}`,
    '',
    'Your Agency Perpetual license (Max tier, up to 10 client deployments) was',
    'emailed at purchase and is always available at admin → Account → License.',
    '',
    '1. Set REVEALUI_LICENSE_KEY to the JWT from your license page.',
    '2. Set REVEALUI_LICENSE_PUBLIC_KEY to the studio public verification key',
    '   (also on the license page).',
    '3. Optional: run RevForge stamp with the revforge.json in this package',
    '   once you have operator access to stamp a full branded kit (P2-B).',
    '',
    'Never put a private signing key in the kit or in browser storage.',
  ].join('\n');

  return {
    version: 1,
    product: 'agency-founding-kit',
    tier: 'max',
    perpetual: true,
    maxSites: 10,
    branding,
    licenseId,
    customerId,
    startHere,
    revforgeConfig: {
      company: branding.company,
      slug: branding.slug,
      email: branding.email,
      brand: branding.brand,
      licenseTier: 'max',
      licensePerpetual: true,
    },
  };
}
