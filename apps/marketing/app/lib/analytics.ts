// Product-analytics sink for the marketing site (Vite + React).
//
// Traffic SSOT: Studio-hosted Umami when `VITE_UMAMI_URL` and
// `VITE_UMAMI_WEBSITE_ID` are set. Transport is POST `/api/send` (pageviews +
// custom events). UTM tags travel in the page URL query so Umami can attribute
// campaigns. The official script host is CSP-allowlisted for the same origin.
//
// Optional Plausible-compatible sink remains when `VITE_ANALYTICS_DOMAIN` is
// set. Both sinks stay dormant without their env keys.
//
// Privacy posture:
//   - Cookie consent: analytics category must be true on `revealui-cookie-consent`.
//     GPC/DNT are reject-optional defaults (CookieConsentManager writes
//     analytics:false until explicit Accept All). An explicit accept is honored.
//   - HIPAA profile (`VITE_COMPLIANCE_PROFILE=hipaa`) disables all sinks.
//   - No PII is collected. Payloads contain the event name (custom events only),
//     page URL (including UTM query), referring URL, and named props — no user
//     identifiers, no advertising cookies, no fingerprints.
//   - Transport: navigator.sendBeacon (fire-and-forget, survives page unload).
//     Falls back to fetch with keepalive:true when sendBeacon is unavailable.
//
// Do not add `@vercel/analytics` / Vercel Web Analytics.
//
import { isHipaaComplianceProfile } from './compliance';

// Privacy disclosure: Cookie Policy §3 describes this sink. Adding Umami (or
// Fly.io as its host) to Privacy Policy third-parties / the Subprocessors
// registry is an owner/legal follow-up — same posture as Sentry, which is
// named in privacy.ts but not yet on the dated subprocessors table.

const UMAMI_SEND_PATH = '/api/send';
const COOKIE_CONSENT_PREFIX = 'revealui-cookie-consent=';
const COOKIE_CONSENT_EVENT = 'revealui:cookie-consent';
const AUDIENCE_EVENT = 'revealui:audience';

const plausibleDomain = import.meta.env.VITE_ANALYTICS_DOMAIN as string | undefined;
const plausibleEndpoint =
  (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined) ??
  'https://plausible.io/api/event';

const umamiUrl = import.meta.env.VITE_UMAMI_URL as string | undefined;
const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;

function withoutTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function isUmamiConfigured(): boolean {
  return Boolean(umamiUrl && umamiWebsiteId);
}

function umamiSendUrl(): string | null {
  if (!(umamiUrl && umamiWebsiteId)) {
    return null;
  }
  return `${withoutTrailingSlash(umamiUrl)}${UMAMI_SEND_PATH}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function hasAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(COOKIE_CONSENT_PREFIX)) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(
        decodeURIComponent(trimmed.slice(COOKIE_CONSENT_PREFIX.length)),
      );
      if (typeof parsed === 'object' && parsed !== null && 'analytics' in parsed) {
        return (parsed as { analytics: unknown }).analytics === true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

function canSend(): boolean {
  // GPC/DNT are reject-optional defaults in CookieConsentManager (analytics:
  // false until explicit Accept). Do not hard-kill after Accept All — that
  // is why revealui.com stayed at 0 while revealuistudio.com (official
  // script.js, no DNT abort) recorded visits.
  return isBrowser() && !isHipaaComplianceProfile() && hasAnalyticsConsent();
}

interface AnalyticsPayload {
  name: string;
  domain: string;
  url: string;
  referrer: string | null;
  props?: Record<string, string | number | boolean>;
}

interface UmamiEventPayload {
  website: string;
  hostname: string;
  language: string;
  referrer: string;
  screen: string;
  title: string;
  url: string;
  name?: string;
  data?: Record<string, string | number | boolean>;
}

function currentPagePath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function screenResolution(): string {
  const screen = window.screen;
  if (!screen) {
    return '';
  }
  return `${screen.width}x${screen.height}`;
}

function buildUmamiPayload(
  name?: string,
  data?: Record<string, string | number | boolean>,
): UmamiEventPayload | null {
  if (!umamiWebsiteId) {
    return null;
  }
  const payload: UmamiEventPayload = {
    website: umamiWebsiteId,
    hostname: window.location.hostname,
    language: typeof navigator.language === 'string' ? navigator.language : '',
    referrer: document.referrer || '',
    screen: screenResolution(),
    title: document.title,
    url: currentPagePath(),
  };
  if (name) {
    payload.name = name;
  }
  if (data) {
    payload.data = data;
  }
  return payload;
}

function sendJson(endpoint: string, body: unknown): void {
  try {
    const serialized = JSON.stringify(body);
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(endpoint, new Blob([serialized], { type: 'application/json' }));
      return;
    }
    fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: serialized,
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional fire-and-forget; errors are swallowed by the outer try/catch
    }).catch(() => {}); // empty-catch-ok: analytics fetch errors are intentionally silenced; the outer try/catch handles hard throws
  } catch {
    // Never propagate analytics errors to the caller.
  }
}

function sendUmami(name?: string, data?: Record<string, string | number | boolean>): void {
  const endpoint = umamiSendUrl();
  const payload = buildUmamiPayload(name, data);
  const websiteId = umamiWebsiteId;
  if (!(endpoint && payload && websiteId)) {
    return;
  }
  // Official script.js uses fetch + these headers. sendBeacon cannot set
  // them; a headerless POST from a non-browser UA is answered {"beep":"boop"}
  // and is not stored. Match the tracker the studio site already ships.
  try {
    void fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'x-umami-website-id': websiteId,
        'x-umami-hostname': window.location.hostname,
      },
      body: JSON.stringify({ type: 'event', payload }),
    }).catch(() => {
      // empty-catch-ok: analytics fetch errors are intentionally silenced
    });
  } catch {
    // Never propagate analytics errors to the caller.
  }
}

function sendPlausible(event: string, props?: Record<string, string | number | boolean>): void {
  if (!plausibleDomain) {
    return;
  }
  const payload: AnalyticsPayload = {
    name: event,
    domain: plausibleDomain,
    url: window.location.href,
    referrer: document.referrer || null,
    props,
  };
  sendJson(plausibleEndpoint, payload);
}

let lastUmamiPageKey: string | null = null;

function trackUmamiPageview(): void {
  if (!(canSend() && isUmamiConfigured())) {
    return;
  }
  const pageKey = currentPagePath();
  if (lastUmamiPageKey === pageKey) {
    return;
  }
  lastUmamiPageKey = pageKey;
  sendUmami();
}

export function track(event: string, props?: Record<string, string | number | boolean>): void {
  if (!canSend()) {
    return;
  }
  sendUmami(event, props);
  sendPlausible(event, props);
}

let mounted = false;
let historyWrapped = false;

function wrapHistoryMethod(method: 'pushState' | 'replaceState'): void {
  const history = window.history;
  const original = history[method];
  if (typeof original !== 'function') {
    return;
  }
  history[method] = function umamiHistoryProxy(
    this: History,
    ...args: Parameters<History['pushState']>
  ): void {
    original.apply(this, args);
    trackUmamiPageview();
  };
}

function installUmamiPageviewTracking(): void {
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('popstate', () => {
      trackUmamiPageview();
    });
    window.addEventListener(COOKIE_CONSENT_EVENT, () => {
      trackUmamiPageview();
    });
  }
  if (!historyWrapped && window.history) {
    wrapHistoryMethod('pushState');
    wrapHistoryMethod('replaceState');
    historyWrapped = true;
  }
  trackUmamiPageview();
}

export function initAnalytics(): void {
  if (!isBrowser()) {
    return;
  }
  if (isHipaaComplianceProfile()) {
    return;
  }
  if (mounted) {
    return;
  }
  mounted = true;

  document.addEventListener(AUDIENCE_EVENT, (e: Event) => {
    const audience = (e as CustomEvent<{ audience: string }>).detail?.audience;
    if (audience) {
      track('Audience Selected', { audience });
    }
  });

  if (isUmamiConfigured()) {
    installUmamiPageviewTracking();
  }
}
