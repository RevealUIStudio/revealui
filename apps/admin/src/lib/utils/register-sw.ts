/**
 * Register the admin service worker for offline support.
 *
 * Call this once on app startup (e.g. in a top-level layout or provider).
 * No-ops when service workers are not supported by the browser.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Defer registration until after the page load for better performance.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Registration failed  -  non-critical. The app works without the SW.
    });
  });
}
