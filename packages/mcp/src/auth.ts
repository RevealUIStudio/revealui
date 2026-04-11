/**
 * MCP Auth Bridge
 *
 * JWT claims validation and tool-level authorization for MCP server launchers.
 * Does NOT verify JWT signatures  -  that is the transport layer's responsibility.
 * This module validates the claims structure, expiration, and tier-based ACL.
 */

import { z } from '@revealui/contracts';

// =============================================================================
// Auth Claims Schema
// =============================================================================

/** JWT claims expected from RevealUI auth tokens */
export const McpAuthClaimsSchema = z.object({
  sub: z.string(), // tenant ID
  tier: z.enum(['free', 'pro', 'max', 'enterprise']),
  iss: z.string().optional(), // issuer
  iat: z.number().optional(), // issued at
  exp: z.number().optional(), // expiration
  permissions: z.array(z.string()).optional(), // tool-level ACL
});

export type McpAuthClaims = z.infer<typeof McpAuthClaimsSchema>;

// =============================================================================
// Claims Validation
// =============================================================================

/**
 * Validate and decode MCP auth claims from a JWT payload.
 * Does NOT verify signature  -  that should be done by the transport layer.
 * This validates the claims structure and expiration.
 */
export function validateMcpClaims(payload: unknown): {
  valid: boolean;
  claims?: McpAuthClaims;
  error?: string;
} {
  // Check expiration before schema validation
  const raw = payload as Record<string, unknown>;
  if (typeof raw?.exp === 'number' && raw.exp < Date.now() / 1000) {
    return { valid: false, error: 'Token expired' };
  }

  const result = McpAuthClaimsSchema.safeParse(payload);
  if (!result.success) {
    return {
      valid: false,
      error: `Invalid claims: ${result.error.issues.map((i) => i.message).join(', ')}`,
    };
  }

  return { valid: true, claims: result.data };
}

// =============================================================================
// Tool Authorization
// =============================================================================

/**
 * Check if claims authorize a specific tool invocation.
 * Verifies both tier level and explicit permissions list (if present).
 */
export function authorizeToolCall(
  claims: McpAuthClaims,
  toolName: string,
  requiredTier: string = 'free',
): { authorized: boolean; reason?: string } {
  const tierOrder = ['free', 'pro', 'max', 'enterprise'];
  const claimIndex = tierOrder.indexOf(claims.tier);
  const requiredIndex = tierOrder.indexOf(requiredTier);

  if (claimIndex < requiredIndex) {
    return {
      authorized: false,
      reason: `Tool requires ${requiredTier} tier, tenant has ${claims.tier}`,
    };
  }

  // Check explicit permissions if provided
  if (claims.permissions && claims.permissions.length > 0) {
    const hasPermission = claims.permissions.includes(toolName) || claims.permissions.includes('*');
    if (!hasPermission) {
      return {
        authorized: false,
        reason: `Tool ${toolName} not in permissions list`,
      };
    }
  }

  return { authorized: true };
}
