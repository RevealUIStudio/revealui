import { describe, expect, it } from 'vitest';
import { ConsentManager } from '../../security/gdpr.js';
import { InMemoryGDPRStorage } from '../../security/gdpr-storage.js';

describe('ConsentManager', () => {
  it('grants consent and stores it', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    const record = await mgr.grantConsent('user1', 'analytics');
    expect(record.granted).toBe(true);
    expect(record.type).toBe('analytics');
    expect(record.userId).toBe('user1');
  });

  it('hasConsent returns true after grant', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    await mgr.grantConsent('user1', 'marketing');
    expect(await mgr.hasConsent('user1', 'marketing')).toBe(true);
  });

  it('revokeConsent makes hasConsent return false', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    await mgr.grantConsent('user1', 'analytics');
    await mgr.revokeConsent('user1', 'analytics');
    expect(await mgr.hasConsent('user1', 'analytics')).toBe(false);
  });

  it('hasConsent returns false for expired consent', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    // Expire in 1ms
    await mgr.grantConsent('user1', 'functional', 'explicit', 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(await mgr.hasConsent('user1', 'functional')).toBe(false);
  });

  it('getUserConsents returns all consents for a user', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    await mgr.grantConsent('userA', 'analytics');
    await mgr.grantConsent('userA', 'marketing');
    await mgr.grantConsent('userB', 'analytics');
    const consents = await mgr.getUserConsents('userA');
    expect(consents).toHaveLength(2);
    expect(consents.every((c) => c.userId === 'userA')).toBe(true);
  });

  it('getStatistics returns correct totals', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    await mgr.grantConsent('u1', 'analytics');
    await mgr.grantConsent('u1', 'marketing');
    await mgr.revokeConsent('u1', 'marketing');
    const stats = await mgr.getStatistics();
    expect(stats.total).toBe(2);
    expect(stats.granted).toBe(1);
    expect(stats.revoked).toBe(1);
  });

  it('consent has a timestamp string', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    const record = await mgr.grantConsent('u1', 'personalization');
    expect(typeof record.timestamp).toBe('string');
    expect(new Date(record.timestamp).getTime()).not.toBeNaN();
  });

  it('consent has a unique id', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    const a = await mgr.grantConsent('u1', 'analytics');
    const b = await mgr.grantConsent('u2', 'analytics');
    expect(a.id).not.toBe(b.id);
  });

  it('needsRenewal returns true when consent is older than maxAge', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    await mgr.grantConsent('u1', 'analytics');
    // maxAge of 0 means always needs renewal
    expect(await mgr.needsRenewal('u1', 'analytics', 0)).toBe(true);
  });

  it('needsRenewal returns false for fresh consent with generous maxAge', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    await mgr.grantConsent('u1', 'analytics');
    expect(await mgr.needsRenewal('u1', 'analytics', 60 * 60 * 1000)).toBe(false);
  });

  it('hasConsent returns false for unknown user', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    expect(await mgr.hasConsent('nobody', 'analytics')).toBe(false);
  });

  it('setConsentVersion updates the version on new records', async () => {
    const mgr = new ConsentManager(new InMemoryGDPRStorage());
    mgr.setConsentVersion('2.0.0');
    const record = await mgr.grantConsent('u1', 'analytics');
    expect(record.version).toBe('2.0.0');
  });
});
