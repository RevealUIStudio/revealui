/**
 * Upgrade-aware fetch utilities.
 *
 * Intercepts 402 (Payment Required) and 503 (feature unavailable) responses
 * and emits a DOM custom event so a global upgrade dialog can prompt the user.
 *
 * @example
 * ```ts
 * import { upgradeAwareFetch } from '@revealui/paywall/client';
 *
 * // Use as a drop-in replacement for fetch
 * const res = await upgradeAwareFetch('/api/ai/tasks', { method: 'POST' });
 * ```
 */

/** The DOM event name dispatched when an upgrade is required. */
export const UPGRADE_EVENT_NAME = 'revealui:upgrade-required';

/** Detail payload for the upgrade event. */
export interface UpgradeEventDetail {
  /** The feature that triggered the upgrade prompt, if known. */
  feature?: string;
  /** The HTTP status code that triggered the event (402 or 503). */
  status: number;
}

/**
 * Dispatch the upgrade-required event manually.
 * Useful when you detect a paywall condition outside of fetch.
 */
export function dispatchUpgradeEvent(detail: UpgradeEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UPGRADE_EVENT_NAME, { detail }));
}

/**
 * Fetch wrapper that intercepts 402 and 503 responses and dispatches
 * a `revealui:upgrade-required` custom event.
 *
 * The response is still returned to the caller — this wrapper only
 * adds the side effect of notifying the upgrade dialog.
 *
 * Reads the feature name from the `x-paywall-feature` or
 * `x-revealui-feature` response header when available.
 */
export function upgradeAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init).then((response) => {
    if (response.status === 402 || response.status === 503) {
      const feature =
        response.headers.get('x-paywall-feature') ??
        response.headers.get('x-revealui-feature') ??
        undefined;
      dispatchUpgradeEvent({ feature, status: response.status });
    }
    return response;
  });
}
