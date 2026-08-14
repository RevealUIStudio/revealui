/**
 * Browser cookie-consent store for the presentation banner.
 *
 * Lockstep twin of `@revealui/security/cookie-consent`. Same cookie name,
 * JSON shape, GPC/DNT rules, and opt-in defaults. Presentation cannot
 * depend on `@revealui/security` without pulling parse5/undici into the
 * UI kit, so the store is copied. Change both files in the same commit.
 */

export const COOKIE_CONSENT_COOKIE = 'revealui-cookie-consent';
export const COOKIE_CONSENT_STORAGE_KEY = 'cookie-consent';
export const COOKIE_CONSENT_VERSION = 1;
/** CNIL / ePrivacy common practice: remember a choice for six months. */
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export interface CookieConsentConfig {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export type CookieConsentSource = 'explicit' | 'gpc' | 'dnt';

export interface CookieConsentRecord extends CookieConsentConfig {
  version: number;
  updatedAt: string;
  source: CookieConsentSource;
}

export const DENIED_OPTIONAL_CONSENT: CookieConsentConfig = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

export const ACCEPTED_ALL_CONSENT: CookieConsentConfig = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

export function detectPrivacySignal(): 'gpc' | 'dnt' | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true) {
    return 'gpc';
  }
  const dnt =
    nav.doNotTrack ??
    (typeof window !== 'undefined'
      ? (window as Window & { doNotTrack?: string }).doNotTrack
      : undefined);
  if (dnt === '1' || dnt === 'yes') {
    return 'dnt';
  }
  return null;
}

export function hasAnalyticsConsent(consent: CookieConsentConfig | null | undefined): boolean {
  return consent?.analytics === true;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isSource(value: unknown): value is CookieConsentSource {
  return value === 'explicit' || value === 'gpc' || value === 'dnt';
}

export function parseCookieConsent(raw: string): CookieConsentRecord | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    // Legacy payloads omit optional keys. Missing optional categories are
    // denied (opt-in). `necessary` cannot be turned off even if a payload lies.
    if ('analytics' in record && !isBoolean(record.analytics)) {
      return null;
    }
    if ('marketing' in record && !isBoolean(record.marketing)) {
      return null;
    }
    if ('functional' in record && !isBoolean(record.functional)) {
      return null;
    }
    if ('necessary' in record && !isBoolean(record.necessary)) {
      return null;
    }
    const updatedAt =
      typeof record.updatedAt === 'string' && record.updatedAt.length > 0
        ? record.updatedAt
        : new Date().toISOString();
    return {
      necessary: true,
      functional: record.functional === true,
      analytics: record.analytics === true,
      marketing: record.marketing === true,
      version: typeof record.version === 'number' ? record.version : COOKIE_CONSENT_VERSION,
      updatedAt,
      source: isSource(record.source) ? record.source : 'explicit',
    };
  } catch {
    return null;
  }
}

export function serializeCookieConsent(record: CookieConsentRecord): string {
  return JSON.stringify({
    necessary: true,
    functional: record.functional,
    analytics: record.analytics,
    marketing: record.marketing,
    version: record.version,
    updatedAt: record.updatedAt,
    source: record.source,
  });
}

function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

function writeConsentCookie(serialized: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') {
    return;
  }
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  // First-party consent cookie must be JS-readable (not HttpOnly).
  // biome-ignore lint/suspicious/noDocumentCookie: this module is the consent cookie writer
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function readStoredConsent(): CookieConsentRecord | null {
  const fromCookie = readCookieValue(COOKIE_CONSENT_COOKIE);
  if (fromCookie) {
    const parsed = parseCookieConsent(fromCookie);
    if (parsed) {
      return parsed;
    }
  }
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const fromStorage = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  if (!fromStorage) {
    return null;
  }
  return parseCookieConsent(fromStorage);
}

export const COOKIE_CONSENT_EVENT = 'revealui:cookie-consent';

function persistRecord(record: CookieConsentRecord): void {
  const serialized = serializeCookieConsent(record);
  writeConsentCookie(serialized, COOKIE_CONSENT_MAX_AGE_SECONDS);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, serialized);
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: record }));
  }
}

/**
 * Cookie consent banner state. Necessary is always on. Optional categories
 * default off until the visitor accepts, rejects, or a privacy signal (GPC/DNT)
 * is treated as reject-optional.
 */
export class CookieConsentManager {
  private config: CookieConsentConfig = { ...DENIED_OPTIONAL_CONSENT };
  private record: CookieConsentRecord | null = null;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.loadFromStorage();
  }

  setConsent(config: Partial<CookieConsentConfig>, source: CookieConsentSource = 'explicit'): void {
    this.config = {
      necessary: true,
      functional: config.functional ?? this.config.functional,
      analytics: config.analytics ?? this.config.analytics,
      marketing: config.marketing ?? this.config.marketing,
    };
    this.record = {
      ...this.config,
      version: COOKIE_CONSENT_VERSION,
      updatedAt: new Date().toISOString(),
      source,
    };
    persistRecord(this.record);
    this.notify();
  }

  acceptAll(): void {
    this.setConsent(ACCEPTED_ALL_CONSENT, 'explicit');
  }

  rejectAll(): void {
    this.setConsent(DENIED_OPTIONAL_CONSENT, 'explicit');
  }

  getConsent(): CookieConsentConfig {
    return { ...this.config };
  }

  getRecord(): CookieConsentRecord | null {
    return this.record ? { ...this.record } : null;
  }

  hasDecision(): boolean {
    return this.record !== null;
  }

  hasConsent(type: keyof CookieConsentConfig): boolean {
    return this.config[type];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  loadFromStorage(): void {
    const stored = readStoredConsent();
    if (stored) {
      this.record = stored;
      this.config = {
        necessary: true,
        functional: stored.functional,
        analytics: stored.analytics,
        marketing: stored.marketing,
      };
      return;
    }
    const signal = detectPrivacySignal();
    if (signal) {
      this.config = { ...DENIED_OPTIONAL_CONSENT };
      this.record = {
        ...this.config,
        version: COOKIE_CONSENT_VERSION,
        updatedAt: new Date().toISOString(),
        source: signal,
      };
      persistRecord(this.record);
      return;
    }
    this.record = null;
    this.config = { ...DENIED_OPTIONAL_CONSENT };
  }

  clearConsent(): void {
    this.config = { ...DENIED_OPTIONAL_CONSENT };
    this.record = null;
    writeConsentCookie('', 0);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    }
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const cookieConsentManager = new CookieConsentManager();
