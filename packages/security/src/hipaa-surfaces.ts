/**
 * HIPAA coverage is per surface, not per brand.
 *
 * Proton will sign a BAA that covers Mail, Drive, Calendar, VPN, and Pass.
 * That does not cover RevealUI's product runtime (Gmail API mail, Neon,
 * Vercel, R2, Sentry, Stripe). Each surface has its own allowed vendors.
 *
 * `available` means the vendor publishes a BAA. It does not mean Studio has
 * a signed copy on file. `forbidden` is blocked in the HIPAA profile.
 */

export type HipaaSurfaceId =
  | 'email'
  | 'files'
  | 'calendar'
  | 'vpn'
  | 'secrets'
  | 'database'
  | 'hosting'
  | 'object-storage'
  | 'payments'
  | 'error-telemetry'
  | 'support';

export type HipaaBaaStatus = 'available' | 'self-hosted' | 'forbidden';

export interface HipaaVendorOption {
  id: string;
  name: string;
  baa: HipaaBaaStatus;
  notes: string;
}

export interface HipaaSurface {
  id: HipaaSurfaceId;
  label: string;
  phiRisk: string;
  vendors: readonly HipaaVendorOption[];
}

export const HIPAA_SURFACES: readonly HipaaSurface[] = [
  {
    id: 'email',
    label: 'Email',
    phiRisk: 'Message body, attachments, recipient address',
    vendors: [
      {
        id: 'proton-mail',
        name: 'Proton Mail',
        baa: 'available',
        notes:
          'Studio human mail. Proton BAA covers Mail. Request: privacy@support.proton.me, subject HIPAA BAA.',
      },
      {
        id: 'smtp-customer',
        name: 'Customer SMTP or Proton Bridge',
        baa: 'self-hosted',
        notes: 'Product HIPAA path for transactional mail. Customer owns the SMTP hop.',
      },
      {
        id: 'gmail-api',
        name: 'Google Workspace Gmail API',
        baa: 'forbidden',
        notes:
          'Default RevealUI transactional sender. No Studio HIPAA BAA. Blocked when REVEALUI_COMPLIANCE_PROFILE=hipaa.',
      },
    ],
  },
  {
    id: 'files',
    label: 'Files and shares',
    phiRisk: 'Documents, images, exports, client artifacts',
    vendors: [
      {
        id: 'proton-drive',
        name: 'Proton Drive',
        baa: 'available',
        notes: 'Studio share path. Same Proton BAA as Mail. Not a product object store.',
      },
      {
        id: 'sync-com',
        name: 'Sync.com',
        baa: 'available',
        notes: 'Fallback if Proton Drive is not ready. BAA after a paid plan.',
      },
      {
        id: 'local-disk',
        name: 'Local disk (operator machine)',
        baa: 'self-hosted',
        notes: 'LTS staging until a signed cloud BAA exists.',
      },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    phiRisk: 'Appointment titles and attendee identities',
    vendors: [
      {
        id: 'proton-calendar',
        name: 'Proton Calendar',
        baa: 'available',
        notes: 'Covered by the Proton BAA. Do not put PHI on Google Calendar.',
      },
    ],
  },
  {
    id: 'vpn',
    label: 'Remote access',
    phiRisk: 'Network path to systems that hold PHI',
    vendors: [
      {
        id: 'proton-vpn',
        name: 'Proton VPN',
        baa: 'available',
        notes: 'Covered by the Proton BAA. Optional for Studio operators.',
      },
    ],
  },
  {
    id: 'secrets',
    label: 'Secrets and passwords',
    phiRisk: 'Credentials that unlock PHI systems',
    vendors: [
      {
        id: 'revvault',
        name: 'revvault',
        baa: 'self-hosted',
        notes: 'Age-encrypted vault on the operator machine. Preferred for fleet secrets.',
      },
      {
        id: 'proton-pass',
        name: 'Proton Pass',
        baa: 'available',
        notes: 'Covered by the Proton BAA. Human passwords only, not the fleet vault.',
      },
    ],
  },
  {
    id: 'database',
    label: 'Database',
    phiRisk: 'Accounts, content, agent memory, any stored PHI',
    vendors: [
      {
        id: 'self-host-postgres',
        name: 'Self-hosted PostgreSQL',
        baa: 'self-hosted',
        notes: 'Honest HIPAA product path today.',
      },
      {
        id: 'neon',
        name: 'Neon',
        baa: 'available',
        notes: 'Hosted default. A Neon HIPAA BAA is a separate commercial step and is not on file.',
      },
    ],
  },
  {
    id: 'hosting',
    label: 'Application hosting',
    phiRisk: 'Request logs, env, runtime memory',
    vendors: [
      {
        id: 'self-host',
        name: 'Self-host (customer machine or VPS)',
        baa: 'self-hosted',
        notes: 'Honest HIPAA product path today.',
      },
      {
        id: 'vercel',
        name: 'Vercel',
        baa: 'available',
        notes: 'Hosted default. HIPAA is an enterprise add-on and is not on file.',
      },
    ],
  },
  {
    id: 'object-storage',
    label: 'Object storage',
    phiRisk: 'Uploaded media and generated files',
    vendors: [
      {
        id: 'local-media',
        name: 'Local or customer bucket',
        baa: 'self-hosted',
        notes: 'HIPAA product path until a signed cloud BAA exists.',
      },
      {
        id: 'cloudflare-r2',
        name: 'Cloudflare R2',
        baa: 'available',
        notes: 'Hosted default. Cloudflare BAA is a separate commercial step and is not on file.',
      },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    phiRisk: 'Must not include diagnoses, treatment, or other PHI in descriptors',
    vendors: [
      {
        id: 'stripe',
        name: 'Stripe',
        baa: 'forbidden',
        notes: 'Billing identity only. Never send PHI in Stripe metadata or descriptions.',
      },
    ],
  },
  {
    id: 'error-telemetry',
    label: 'Error telemetry',
    phiRisk: 'URLs, request bodies, session replay',
    vendors: [
      {
        id: 'local-logs',
        name: 'Local logs',
        baa: 'self-hosted',
        notes: 'HIPAA profile keeps Sentry replay and tracing off.',
      },
      {
        id: 'sentry',
        name: 'Sentry',
        baa: 'forbidden',
        notes: 'Blocked in the HIPAA profile. A Sentry BAA would still need replay off for PHI.',
      },
    ],
  },
  {
    id: 'support',
    label: 'Support inbox',
    phiRisk: 'Anything a customer pastes into a ticket',
    vendors: [
      {
        id: 'proton-mail-support',
        name: 'Proton Mail support inbox',
        baa: 'available',
        notes: 'Same Proton BAA as Studio mail. Refuse PHI in the agency contact form.',
      },
    ],
  },
];

export function getHipaaSurface(id: HipaaSurfaceId): HipaaSurface {
  const surface = HIPAA_SURFACES.find((entry) => entry.id === id);
  if (!surface) {
    throw new Error(`Unknown HIPAA surface: ${id}`);
  }
  return surface;
}

export function isHipaaVendorAllowed(surfaceId: HipaaSurfaceId, vendorId: string): boolean {
  const vendor = getHipaaSurface(surfaceId).vendors.find((entry) => entry.id === vendorId);
  if (!vendor) {
    return false;
  }
  return vendor.baa !== 'forbidden';
}

/** Vendors the default hosted product would pick that the HIPAA profile must not use. */
export function listHipaaBlockedDefaultVendors(): readonly {
  surfaceId: HipaaSurfaceId;
  vendorId: string;
  name: string;
}[] {
  const blocked: { surfaceId: HipaaSurfaceId; vendorId: string; name: string }[] = [];
  for (const surface of HIPAA_SURFACES) {
    for (const vendor of surface.vendors) {
      if (vendor.baa === 'forbidden') {
        blocked.push({ surfaceId: surface.id, vendorId: vendor.id, name: vendor.name });
      }
    }
  }
  return blocked;
}

export const HIPAA_GMAIL_API_VENDOR_ID = 'gmail-api';
