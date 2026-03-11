/**
 * Upgrade-aware fetch wrapper.
 *
 * Intercepts 503 (Pro packages not installed) and 402 (license required)
 * responses and emits a `revealui:upgrade-required` custom event so the
 * global UpgradeDialog can prompt the user.
 */

export function upgradeAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init).then((response) => {
    if (response.status === 503 || response.status === 402) {
      const feature = response.headers.get('x-revealui-feature') ?? undefined;
      window.dispatchEvent(
        new CustomEvent('revealui:upgrade-required', {
          detail: { feature, status: response.status },
        }),
      );
    }
    return response;
  });
}
