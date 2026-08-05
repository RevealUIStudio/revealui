/**
 * GAP-448 Phase 2: build Agency Founding Kit package metadata.
 *
 * P2-A thin: START-HERE + revforge.json + manifest (jsonb + text download).
 * P2-B full: same files packed as tar.gz and uploaded to R2 (artifact_uri);
 * optional local stamp.sh on long workers (REVEALUI_KIT_STAMP_RUN=1).
 * Never embeds REVEALUI_LICENSE_PRIVATE_KEY.
 *
 * Types mirror packages/db kit-fulfillments schema (kept local so pure unit
 * tests do not need @revealui/db dist).
 */

const DEFAULT_BRAND = '#1a56db';
const TEMPLATE_VERSION = 'agency-founding-kit-p2b-1';
const DEFAULT_IMAGE_TAG = 'latest';

export type KitPackageFormat = 'text' | 'tar.gz';
export type KitStampSource = 'package' | 'revforge-stamp';

export interface KitFulfillmentBranding {
  company: string;
  slug: string;
  brand: string;
  email: string;
}

export interface KitFulfillmentArtifact {
  version: 1;
  /** Delivery shape: text multi-file (thin) or tar.gz via artifact_uri (full). */
  packageFormat?: KitPackageFormat;
  /** How the full archive was produced (P2-B). */
  stampSource?: KitStampSource;
  manifest: {
    product: 'agency-founding-kit';
    tier: 'max';
    perpetual: true;
    maxSites: 10;
    maxUsers: 100;
    licenseId: string;
    templateVersion: string;
    imageTag: string;
    livemode: boolean;
  };
  startHereMarkdown: string;
  revforgeJson: Record<string, unknown>;
}

export interface BuildAgencyKitArtifactInput {
  branding: KitFulfillmentBranding;
  licenseId: string;
  livemode: boolean;
  packageFormat?: KitPackageFormat;
}

/**
 * Sanitize a free-form company name into a URL-safe slug.
 * Empty / garbage input falls back to `agency-kit`.
 */
export function slugifyCompany(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug.length > 0 ? slug : 'agency-kit';
}

/**
 * Resolve branding with defaults when checkout metadata is sparse.
 */
export function resolveAgencyKitBranding(input: {
  company?: string | null;
  slug?: string | null;
  brand?: string | null;
  email: string;
}): KitFulfillmentBranding {
  const email = input.email.trim().toLowerCase();
  const local = email.split('@')[0] || 'buyer';
  const company =
    (input.company?.trim() && input.company.trim()) ||
    local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Agency Buyer';
  const slug = (input.slug?.trim() && slugifyCompany(input.slug.trim())) || slugifyCompany(company);
  const brandRaw = input.brand?.trim() || DEFAULT_BRAND;
  const brand = /^#[0-9A-Fa-f]{6}$/.test(brandRaw) ? brandRaw : DEFAULT_BRAND;
  return { company, slug, brand, email };
}

export function buildAgencyKitArtifact(input: BuildAgencyKitArtifactInput): KitFulfillmentArtifact {
  const { branding, licenseId, livemode } = input;
  const packageFormat = input.packageFormat ?? 'text';
  const startHereMarkdown = [
    `# RevealUI Agency Founding Kit — ${branding.company}`,
    '',
    'Thank you for purchasing the **Agency Founding Kit** (Agency Perpetual).',
    '',
    '## What you already have',
    '',
    '1. **License key** — emailed at purchase and available at Admin → Account → License.',
    '2. **This package** — stamp config so you (or Studio ops) can produce a branded Fleet kit.',
    '',
    '## Activate the license on a self-host',
    '',
    '```bash',
    'export REVEALUI_LICENSE_KEY="<paste-jwt-from-email-or-license-page>"',
    '```',
    '',
    'Or pass the key into `initializeLicense(key)` at boot. The key is Max-tier, perpetual,',
    'and embeds **maxSites 10** (client deployments) plus seat caps.',
    '',
    '## Stamp a branded kit (operator / advanced)',
    '',
    'From a machine with [RevForge](https://github.com/RevealUIStudio/revforge) and revvault:',
    '',
    '```bash',
    './stamp.sh --config revforge.json',
    '```',
    '',
    'The included `revforge.json` is pre-filled for your branding. `maxSites: 10` is the',
    'Agency perpetual default when using `--license-tier max --license-perpetual`.',
    '',
    packageFormat === 'tar.gz'
      ? 'This download is a **.tar.gz** archive (START-HERE.md, revforge.json, manifest.json).'
      : 'This download is a multi-file text package (extract sections between ---FILE--- markers).',
    '',
    '## Support',
    '',
    'One year of support is included with purchase. Reply to your license email or open',
    'https://revealui.com/support',
    '',
    `Template: ${TEMPLATE_VERSION}`,
    '',
  ].join('\n');

  const revforgeJson = {
    company: branding.company,
    slug: branding.slug,
    email: branding.email,
    brand: branding.brand,
    licenseTier: 'max',
    licensePerpetual: true,
    licenseMaxSites: 10,
    fleetMode: true,
    notes: {
      product: 'agency-founding-kit',
      licenseId,
      livemode,
      templateVersion: TEMPLATE_VERSION,
    },
  };

  return {
    version: 1,
    packageFormat,
    manifest: {
      product: 'agency-founding-kit',
      tier: 'max',
      perpetual: true,
      maxSites: 10,
      maxUsers: 100,
      licenseId,
      templateVersion: TEMPLATE_VERSION,
      imageTag: DEFAULT_IMAGE_TAG,
      livemode,
    },
    startHereMarkdown,
    revforgeJson,
  };
}

/** Bundle thin package as a single UTF-8 multi-file payload for download. */
export function serializeKitArtifactForDownload(artifact: KitFulfillmentArtifact): string {
  const sep = '\n---FILE---\n';
  return [
    `# RevealUI Agency Founding Kit package (${artifact.manifest.templateVersion})`,
    '',
    '## files',
    '',
    '### START-HERE.md',
    sep,
    artifact.startHereMarkdown,
    sep,
    '### revforge.json',
    sep,
    `${JSON.stringify(artifact.revforgeJson, null, 2)}\n`,
    sep,
    '### manifest.json',
    sep,
    `${JSON.stringify(artifact.manifest, null, 2)}\n`,
  ].join('');
}
