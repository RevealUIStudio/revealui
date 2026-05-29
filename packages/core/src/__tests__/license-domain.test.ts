import { describe, expect, it } from 'vitest';
import { hostMatchesLicensedDomains } from '../license.js';

// Migrated from the deleted apps/server domain-lock.test.ts host-matching
// cases, plus the matcher edge cases that requireDomain + the boot check rely
// on. This is the single home for the domain-match primitive's tests.
describe('hostMatchesLicensedDomains', () => {
  const domains = ['example.com'];

  it('matches an exact domain', () => {
    expect(hostMatchesLicensedDomains('example.com', domains)).toBe(true);
  });

  it('matches a subdomain of a licensed domain', () => {
    expect(hostMatchesLicensedDomains('app.example.com', domains)).toBe(true);
  });

  it('matches deeply nested subdomains', () => {
    expect(hostMatchesLicensedDomains('deep.nested.app.example.com', domains)).toBe(true);
  });

  it('strips a :port suffix before matching', () => {
    expect(hostMatchesLicensedDomains('example.com:3000', domains)).toBe(true);
  });

  it('is case-insensitive on both host and domain', () => {
    expect(hostMatchesLicensedDomains('EXAMPLE.com', ['Example.COM'])).toBe(true);
  });

  it('trims surrounding whitespace on host and domain', () => {
    expect(hostMatchesLicensedDomains('  example.com  ', ['  example.com  '])).toBe(true);
  });

  it('always allows localhost (so trial kits boot on http://localhost)', () => {
    expect(hostMatchesLicensedDomains('localhost', domains)).toBe(true);
    expect(hostMatchesLicensedDomains('localhost:4000', domains)).toBe(true);
  });

  it('always allows 127.0.0.1', () => {
    expect(hostMatchesLicensedDomains('127.0.0.1:8080', domains)).toBe(true);
  });

  it('rejects an unlicensed domain', () => {
    expect(hostMatchesLicensedDomains('evil.com', domains)).toBe(false);
  });

  it('rejects a similar host whose suffix is not on a dot boundary', () => {
    expect(hostMatchesLicensedDomains('notexample.com', domains)).toBe(false);
  });

  it('returns false for an empty host', () => {
    expect(hostMatchesLicensedDomains('', domains)).toBe(false);
  });

  it('returns false when the domains list is empty', () => {
    expect(hostMatchesLicensedDomains('example.com', [])).toBe(false);
  });

  it('ignores empty / whitespace-only entries in the domains list', () => {
    expect(hostMatchesLicensedDomains('example.com', ['', '   '])).toBe(false);
    expect(hostMatchesLicensedDomains('example.com', ['', 'example.com'])).toBe(true);
  });

  it('matches against any entry when multiple domains are licensed', () => {
    const multi = ['acme.com', 'example.com'];
    expect(hostMatchesLicensedDomains('admin.example.com', multi)).toBe(true);
    expect(hostMatchesLicensedDomains('acme.com', multi)).toBe(true);
    expect(hostMatchesLicensedDomains('other.org', multi)).toBe(false);
  });
});
