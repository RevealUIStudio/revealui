/**
 * Studio Health API Client
 *
 * Fetches production health status from the RevealUI API's
 * /health/ready endpoint (public, no auth required).
 */

// ── Response types ──────────────────────────────────────────────────────────

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  duration?: number;
  message?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: Record<string, HealthCheck> | HealthCheck[];
  corsConfigMissing?: boolean;
}

// ── Client ──────────────────────────────────────────────────────────────────

/**
 * Fetch the readiness probe from the API. Public endpoint  -  no auth needed.
 * Returns null if the API is unreachable (network error).
 */
export async function fetchHealth(apiUrl: string): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${apiUrl}/health/ready`, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    });
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}
