// Product-analytics sink for the marketing site (Vite + React).
//
// Privacy posture:
//   - Fully dormant when `VITE_ANALYTICS_DOMAIN` is absent. The module is shipped
//     so events flow the moment the env var is set in Vercel, without redeploying.
//   - Respects Do-Not-Track (DNT). All tracking is silently skipped for any visitor
//     whose browser sends DNT=1 / DNT=yes.
//   - No PII is collected. Payloads contain only the event name, domain, page URL,
//     referring URL, and the named props passed by the caller — no user identifiers,
//     no cookies, no fingerprints.
//   - Transport: navigator.sendBeacon (fire-and-forget, survives page unload).
//     Falls back to fetch with keepalive:true when sendBeacon is unavailable.
//   - Payload format is Plausible-compatible so the endpoint can be Plausible Cloud,
//     a self-hosted Plausible instance, or any compatible ingest server.
//
// Required follow-up before production:
//   - CSP: add the analytics endpoint host to `connect-src` in apps/marketing/vercel.json.
//   - Privacy disclosure: adding any analytics provider as a subprocessor requires
//     an update to apps/marketing/app/content/legal/privacy.ts (owner/legal decision).

const domain = import.meta.env.VITE_ANALYTICS_DOMAIN as string | undefined;
const endpoint =
  (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined) ??
  'https://plausible.io/api/event';

function isDntEnabled(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  return (
    navigator.doNotTrack === '1' ||
    navigator.doNotTrack === 'yes' ||
    (window as Window & { doNotTrack?: string }).doNotTrack === '1'
  );
}

interface AnalyticsPayload {
  name: string;
  domain: string;
  url: string;
  referrer: string | null;
  props?: Record<string, string | number | boolean>;
}

export function track(event: string, props?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  if (isDntEnabled()) {
    return;
  }
  if (!domain) {
    return;
  }

  const payload: AnalyticsPayload = {
    name: event,
    domain,
    url: window.location.href,
    referrer: document.referrer || null,
    props,
  };

  try {
    const body = JSON.stringify(payload);
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(endpoint, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body,
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional fire-and-forget; errors are swallowed by the outer try/catch
      }).catch(() => {}); // empty-catch-ok: analytics fetch errors are intentionally silenced; the outer try/catch handles hard throws
    }
  } catch {
    // Never propagate analytics errors to the caller.
  }
}

let mounted = false;

export function initAnalytics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  if (isDntEnabled()) {
    return;
  }
  if (mounted) {
    return;
  }
  mounted = true;

  document.addEventListener('revealui:audience', (e: Event) => {
    const audience = (e as CustomEvent<{ audience: string }>).detail?.audience;
    if (audience) {
      track('Audience Selected', { audience });
    }
  });
}
