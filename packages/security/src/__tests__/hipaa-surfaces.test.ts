import { describe, expect, it } from 'vitest';
import {
  getHipaaSurface,
  HIPAA_GMAIL_API_VENDOR_ID,
  HIPAA_SURFACES,
  isHipaaVendorAllowed,
  listHipaaBlockedDefaultVendors,
} from '../hipaa-surfaces.js';

describe('HIPAA surfaces', () => {
  it('covers email, files, and the product runtime, not only Proton Mail', () => {
    const ids = HIPAA_SURFACES.map((surface) => surface.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'email',
        'files',
        'database',
        'hosting',
        'object-storage',
        'payments',
        'error-telemetry',
      ]),
    );
  });

  it('allows Proton Mail and customer SMTP, and forbids the Gmail API', () => {
    expect(isHipaaVendorAllowed('email', 'proton-mail')).toBe(true);
    expect(isHipaaVendorAllowed('email', 'smtp-customer')).toBe(true);
    expect(isHipaaVendorAllowed('email', HIPAA_GMAIL_API_VENDOR_ID)).toBe(false);
  });

  it('allows Proton Drive and local disk for files', () => {
    expect(isHipaaVendorAllowed('files', 'proton-drive')).toBe(true);
    expect(isHipaaVendorAllowed('files', 'local-disk')).toBe(true);
    expect(isHipaaVendorAllowed('files', 'sync-com')).toBe(true);
  });

  it('does not treat Neon or Vercel as signed just because a DPA exists', () => {
    const neon = getHipaaSurface('database').vendors.find((vendor) => vendor.id === 'neon');
    const vercel = getHipaaSurface('hosting').vendors.find((vendor) => vendor.id === 'vercel');
    expect(neon?.baa).toBe('available');
    expect(vercel?.baa).toBe('available');
  });

  it('lists Gmail API, Stripe-as-PHI, and Sentry as blocked defaults', () => {
    const blocked = listHipaaBlockedDefaultVendors();
    expect(blocked.map((entry) => entry.vendorId)).toEqual(
      expect.arrayContaining(['gmail-api', 'stripe', 'sentry']),
    );
  });

  it('rejects unknown vendors', () => {
    expect(isHipaaVendorAllowed('email', 'resend')).toBe(false);
  });
});
