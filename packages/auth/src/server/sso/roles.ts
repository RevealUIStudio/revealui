/**
 * SSO group → role mapping (GAP-464).
 *
 * Security hardlines:
 * - Map only via explicit group_role_map hits.
 * - Empty mapped set + require_group_match → reject.
 * - Never grant `admin` from an unmapped group (unmapped groups are ignored).
 * - When no map hits and require_group_match is false → default_role.
 */

export interface MapSsoGroupsInput {
  /** Raw IdP claims (id_token payload or SAML attribute bag) */
  claims: Record<string, unknown>;
  /** Claim key that holds group membership (default on providers: `groups`) */
  groupClaim: string;
  /** IdP group name → RevealUI role */
  groupRoleMap: Record<string, string>;
  /** Used when no groups map and requireGroupMatch is false */
  defaultRole: string;
  /** When true, login fails unless at least one group maps to a role */
  requireGroupMatch: boolean;
}

export type MapSsoGroupsFailureReason = 'require_group_match' | 'invalid_default_role';

export type MapSsoGroupsResult =
  | {
      ok: true;
      role: string;
      /** Groups present on the token that hit group_role_map */
      matchedGroups: string[];
      /** All groups extracted from the claim (mapped + unmapped) */
      groups: string[];
    }
  | {
      ok: false;
      reason: MapSsoGroupsFailureReason;
      message: string;
      groups: string[];
    };

/** Privilege rank for resolving multiple mapped roles (higher wins). */
const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  member: 2,
  editor: 3,
  admin: 4,
  owner: 5,
};

/**
 * Extract a string array of groups from a claim value.
 * Accepts string[], a single string, or a space/comma-separated string.
 */
export function extractGroupsFromClaim(
  claims: Record<string, unknown>,
  groupClaim: string,
): string[] {
  const raw = claims[groupClaim];
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw
      .filter((g): g is string => typeof g === 'string' && g.length > 0)
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    // Single group name, or space/comma-separated list from some IdPs
    if (trimmed.includes(',') || trimmed.includes(' ')) {
      return trimmed
        .split(/[,\s]+/)
        .map((g) => g.trim())
        .filter((g) => g.length > 0);
    }
    return [trimmed];
  }

  return [];
}

function pickHighestRole(roles: string[]): string {
  let best = roles[0] as string;
  let bestRank = ROLE_RANK[best] ?? 0;
  for (let i = 1; i < roles.length; i++) {
    const role = roles[i] as string;
    const rank = ROLE_RANK[role] ?? 0;
    if (rank > bestRank) {
      best = role;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * Resolve a single RevealUI role from IdP groups + provider mapping config.
 *
 * Unmapped groups never contribute a role (including never implying admin).
 * Only explicit map values and the configured default_role assign roles.
 */
export function mapSsoGroupsToRole(input: MapSsoGroupsInput): MapSsoGroupsResult {
  const { claims, groupClaim, groupRoleMap, defaultRole, requireGroupMatch } = input;

  if (!defaultRole || typeof defaultRole !== 'string') {
    return {
      ok: false,
      reason: 'invalid_default_role',
      message: 'default_role must be a non-empty string',
      groups: [],
    };
  }

  const groups = extractGroupsFromClaim(claims, groupClaim);
  const matchedGroups: string[] = [];
  const mappedRoles: string[] = [];

  for (const group of groups) {
    const mapped = groupRoleMap[group];
    if (typeof mapped === 'string' && mapped.length > 0) {
      matchedGroups.push(group);
      mappedRoles.push(mapped);
    }
    // Unmapped groups intentionally ignored — never grant admin (or any role) from them
  }

  if (mappedRoles.length > 0) {
    return {
      ok: true,
      role: pickHighestRole(mappedRoles),
      matchedGroups,
      groups,
    };
  }

  if (requireGroupMatch) {
    return {
      ok: false,
      reason: 'require_group_match',
      message: 'No IdP groups matched group_role_map and require_group_match is enabled',
      groups,
    };
  }

  return {
    ok: true,
    role: defaultRole,
    matchedGroups: [],
    groups,
  };
}
