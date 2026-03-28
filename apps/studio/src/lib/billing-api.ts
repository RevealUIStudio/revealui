/**
 * Studio Billing API Client
 *
 * Communicates with the RevealUI API's /api/billing endpoints
 * using the device bearer token for authentication.
 */

// ── Response types ──────────────────────────────────────────────────────────

export type BillingTier = 'free' | 'pro' | 'max' | 'enterprise';

export interface SubscriptionResponse {
  tier: BillingTier;
  status: string;
  expiresAt: string | null;
  licenseKey: string | null;
  graceUntil?: string | null;
}

export interface UsageResponse {
  used: number;
  quota: number;
  overage: number;
  cycleStart: string;
  resetAt: string;
}

// ── Client ──────────────────────────────────────────────────────────────────

async function authedGet<T>(apiUrl: string, path: string, token: string): Promise<T> {
  const res = await fetch(`${apiUrl}/api/billing${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Billing API ${path} returned ${res.status}`);
  }

  return (await res.json()) as T;
}

/**
 * Fetch the current user's subscription/license status.
 */
export async function fetchSubscription(
  apiUrl: string,
  token: string,
): Promise<SubscriptionResponse> {
  return authedGet<SubscriptionResponse>(apiUrl, '/subscription', token);
}

/**
 * Fetch the current billing cycle's agent task usage.
 */
export async function fetchUsage(apiUrl: string, token: string): Promise<UsageResponse> {
  return authedGet<UsageResponse>(apiUrl, '/usage', token);
}
