/** Default timeout for Electric shape proxy fetch requests (milliseconds). */
const SHAPE_FETCH_TIMEOUT_MS = 10_000;

/**
 * A fetch wrapper that aborts requests after {@link SHAPE_FETCH_TIMEOUT_MS} (10 s).
 * Passed as `fetchClient` to ElectricSQL `useShape` so that shape subscription
 * requests to the admin proxy do not hang indefinitely.
 */
export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // If the caller already provides a signal, respect it and compose with our timeout.
  const externalSignal = init?.signal;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHAPE_FETCH_TIMEOUT_MS);

  // If the external signal aborts, forward to our controller.
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), {
        once: true,
      });
    }
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}
