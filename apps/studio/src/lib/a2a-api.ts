/**
 * Studio A2A API Client
 *
 * Fetches registered cloud agents from the A2A discovery endpoint.
 * GET /a2a/agents is public (no auth required).
 */

// ── Response types ──────────────────────────────────────────────────────────

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
  };
  skills?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

// ── Client ──────────────────────────────────────────────────────────────────

/**
 * Fetch all registered A2A agent cards. Public endpoint  -  no auth needed.
 * Returns empty array if unreachable or no agents registered.
 */
export async function fetchAgentCards(apiUrl: string): Promise<AgentCard[]> {
  try {
    const res = await fetch(`${apiUrl}/a2a/agents`, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as AgentCard[]) : [];
  } catch {
    return [];
  }
}
