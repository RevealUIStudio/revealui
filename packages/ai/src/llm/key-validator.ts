/**
 * BYOK Provider Key Validator
 *
 * Validates API keys against their provider before storage.
 * Uses the cheapest available endpoint for each provider  -  typically a
 * models list (read-only, no token cost). Falls back gracefully when the
 * provider is unreachable so that network failures don't block key storage.
 */

export type ProviderValidationResult = { valid: true } | { valid: false; error: string };

/** Timeout for validation probes (ms). Kept short to avoid blocking the request. */
const VALIDATION_TIMEOUT_MS = 4_000;

async function probeFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate an API key against the given provider.
 *
 * Unreachable providers return `{ valid: true }` with a warning comment so
 * that network outages (especially for Ollama) never block key storage.
 *
 * @param provider - One of the allowed BYOK provider identifiers
 * @param apiKey   - The plaintext key to probe
 */
export async function validateProviderKey(
  provider: string,
  apiKey: string,
): Promise<ProviderValidationResult> {
  try {
    switch (provider) {
      case 'groq': {
        const res = await probeFetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) return { valid: true };
        if (res.status === 401) return { valid: false, error: 'Invalid Groq API key' };
        // Any other non-OK status (429, 500 etc.)  -  treat as reachable but unknown
        return { valid: false, error: `Groq validation failed: HTTP ${res.status}` };
      }

      case 'huggingface': {
        const res = await probeFetch('https://huggingface.co/api/whoami-v2', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) return { valid: true };
        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: 'Invalid HuggingFace token' };
        }
        return { valid: false, error: `HuggingFace validation failed: HTTP ${res.status}` };
      }

      case 'ollama': {
        // Ollama is local  -  we cannot reliably probe it from the server.
        // Accept the key as-is (Ollama doesn't use API keys anyway).
        return { valid: true };
      }

      default:
        // Unknown provider  -  skip validation
        return { valid: true };
    }
  } catch (err) {
    // Network error (AbortError, DNS failure, etc.)  -  don't block storage
    if (err instanceof Error && err.name === 'AbortError') {
      // Timeout  -  provider unreachable, proceed with storage
      return { valid: true };
    }
    // Other network errors (ECONNREFUSED, etc.)  -  proceed with storage
    return { valid: true };
  }
}
