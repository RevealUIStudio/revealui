/**
 * Browser cookie-consent store. The manager used to live in gdpr.ts behind
 * the server entry (node:crypto), so no app could actually read it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCEPTED_ALL_CONSENT,
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  CookieConsentManager,
  DENIED_OPTIONAL_CONSENT,
  detectPrivacySignal,
  hasAnalyticsConsent,
  parseCookieConsent,
  serializeCookieConsent,
} from '../cookie-consent.js';

interface CookieJar {
  value: string;
  lastWrite: string;
}

function installBrowserStubs(options?: {
  cookie?: string;
  localStorage?: Record<string, string>;
  gpc?: boolean;
  dnt?: string | null;
}): { jar: CookieJar; storage: Map<string, string> } {
  const jar: CookieJar = { value: options?.cookie ?? '', lastWrite: '' };
  const storage = new Map<string, string>(Object.entries(options?.localStorage ?? {}));

  vi.stubGlobal('document', {
    get cookie() {
      return jar.value;
    },
    set cookie(next: string) {
      jar.lastWrite = next;
      const pair = next.split(';')[0] ?? '';
      const eq = pair.indexOf('=');
      const name = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? '' : pair.slice(eq + 1);
      if (next.includes('Max-Age=0')) {
        jar.value = jar.value
          .split('; ')
          .filter((part) => part.length > 0 && !part.startsWith(`${name}=`))
          .join('; ');
        return;
      }
      const others = jar.value
        .split('; ')
        .filter((part) => part.length > 0 && !part.startsWith(`${name}=`));
      others.push(`${name}=${value}`);
      jar.value = others.join('; ');
    },
  });

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });

  vi.stubGlobal('navigator', {
    globalPrivacyControl: options?.gpc ?? false,
    doNotTrack: options?.dnt ?? null,
  });

  vi.stubGlobal('window', {
    doNotTrack: options?.dnt ?? undefined,
    location: { protocol: 'https:' },
  });

  return { jar, storage };
}

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseCookieConsent / serializeCookieConsent', () => {
  it('round-trips a v1 record', () => {
    const record = {
      ...ACCEPTED_ALL_CONSENT,
      version: COOKIE_CONSENT_VERSION,
      updatedAt: '2026-08-13T00:00:00.000Z',
      source: 'explicit' as const,
    };
    const parsed = parseCookieConsent(serializeCookieConsent(record));
    expect(parsed).toEqual(record);
  });

  it('accepts the legacy localStorage shape without version or source', () => {
    const parsed = parseCookieConsent(
      JSON.stringify({ necessary: true, functional: false, analytics: true, marketing: false }),
    );
    expect(parsed).toMatchObject({
      necessary: true,
      functional: false,
      analytics: true,
      marketing: false,
      version: COOKIE_CONSENT_VERSION,
      source: 'explicit',
    });
    expect(parsed?.updatedAt).toBeDefined();
  });

  it('rejects malformed payloads', () => {
    expect(parseCookieConsent('not-json')).toBeNull();
    expect(parseCookieConsent('[]')).toBeNull();
    expect(parseCookieConsent(JSON.stringify({ analytics: 'yes' }))).toBeNull();
  });

  it('never lets necessary be turned off', () => {
    const parsed = parseCookieConsent(
      JSON.stringify({ necessary: false, functional: true, analytics: true, marketing: true }),
    );
    expect(parsed?.necessary).toBe(true);
  });

  it('defaults missing optional categories to false (opt-in)', () => {
    const parsed = parseCookieConsent(JSON.stringify({ necessary: true }));
    expect(parsed).toMatchObject({
      functional: false,
      analytics: false,
      marketing: false,
    });
  });
});

describe('CookieConsentManager', () => {
  it('starts undecided with optional categories denied', () => {
    const manager = new CookieConsentManager();
    expect(manager.hasDecision()).toBe(false);
    expect(manager.getConsent()).toEqual(DENIED_OPTIONAL_CONSENT);
    expect(manager.hasConsent('necessary')).toBe(true);
    expect(manager.hasConsent('analytics')).toBe(false);
  });

  it('acceptAll persists cookie + localStorage and notifies listeners', () => {
    const { jar } = installBrowserStubs();
    const manager = new CookieConsentManager();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.acceptAll();

    expect(manager.hasDecision()).toBe(true);
    expect(manager.getConsent()).toEqual(ACCEPTED_ALL_CONSENT);
    expect(listener).toHaveBeenCalledOnce();
    expect(document.cookie).toContain(COOKIE_CONSENT_COOKIE);
    expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toContain('"analytics":true');
    expect(jar.lastWrite).toContain(`Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`);
    expect(jar.lastWrite).toContain('SameSite=Lax');
  });

  it('rejectAll persists optional categories as false', () => {
    const manager = new CookieConsentManager();
    manager.rejectAll();
    expect(manager.getConsent()).toEqual(DENIED_OPTIONAL_CONSENT);
    expect(manager.hasDecision()).toBe(true);
  });

  it('loads a previously stored decision', () => {
    const first = new CookieConsentManager();
    first.setConsent({ analytics: true, functional: true });

    const second = new CookieConsentManager();
    expect(second.hasDecision()).toBe(true);
    expect(second.hasConsent('analytics')).toBe(true);
    expect(second.hasConsent('functional')).toBe(true);
    expect(second.hasConsent('marketing')).toBe(false);
  });

  it('honors GPC as a reject-optional decision when nothing is stored', () => {
    vi.unstubAllGlobals();
    installBrowserStubs({ gpc: true });
    const manager = new CookieConsentManager();
    expect(manager.hasDecision()).toBe(true);
    expect(manager.getConsent()).toEqual(DENIED_OPTIONAL_CONSENT);
    expect(manager.getRecord()?.source).toBe('gpc');
  });

  it('honors DNT the same way as GPC', () => {
    vi.unstubAllGlobals();
    installBrowserStubs({ dnt: '1' });
    const manager = new CookieConsentManager();
    expect(manager.hasDecision()).toBe(true);
    expect(manager.getRecord()?.source).toBe('dnt');
    expect(manager.hasConsent('analytics')).toBe(false);
  });

  it('does not overwrite an explicit accept when GPC is also set', () => {
    const first = new CookieConsentManager();
    first.acceptAll();
    const storedCookie = document.cookie;
    const storedLocal = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) ?? '';
    vi.unstubAllGlobals();
    installBrowserStubs({
      cookie: storedCookie,
      localStorage: { [COOKIE_CONSENT_STORAGE_KEY]: storedLocal },
      gpc: true,
    });
    const second = new CookieConsentManager();
    expect(second.getConsent()).toEqual(ACCEPTED_ALL_CONSENT);
    expect(second.getRecord()?.source).toBe('explicit');
  });

  it('clearConsent returns to undecided + deny-optional', () => {
    const manager = new CookieConsentManager();
    manager.acceptAll();
    manager.clearConsent();
    expect(manager.hasDecision()).toBe(false);
    expect(manager.getConsent()).toEqual(DENIED_OPTIONAL_CONSENT);
    expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('unsubscribe stops further notifications', () => {
    const manager = new CookieConsentManager();
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);
    unsub();
    manager.rejectAll();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('detectPrivacySignal / hasAnalyticsConsent', () => {
  it('detects GPC before DNT', () => {
    vi.unstubAllGlobals();
    installBrowserStubs({ gpc: true, dnt: '1' });
    expect(detectPrivacySignal()).toBe('gpc');
  });

  it('treats missing or denied analytics as no consent', () => {
    expect(hasAnalyticsConsent(null)).toBe(false);
    expect(hasAnalyticsConsent(DENIED_OPTIONAL_CONSENT)).toBe(false);
    expect(hasAnalyticsConsent(ACCEPTED_ALL_CONSENT)).toBe(true);
  });
});
