/**
 * MFA Enforcement Middleware
 *
 * Provides a middleware factory that enforces Multi-Factor Authentication
 * for specific roles and sensitive operations. SOC2 6.2 compliant.
 */

// =============================================================================
// Types
// =============================================================================

/** Options for the MFA enforcement middleware. */
export interface MfaEnforcementOptions {
  /** Roles that require MFA to be enabled (default: ['admin']). */
  roles?: string[];
  /** Operations that require MFA (e.g. 'delete_user', 'change_role'). */
  operations?: string[];
}

/** Shape of a session user as expected by the middleware. */
export interface MfaSessionUser {
  /** User ID. */
  id: string;
  /** User's role. */
  role: string;
  /** Whether MFA is enabled on the account. */
  mfaEnabled: boolean;
  /** Whether MFA was verified in this session. */
  mfaVerified?: boolean;
}

/** Shape of the session object the middleware reads from. */
export interface MfaSession {
  user: MfaSessionUser;
}

/** Request shape expected by the middleware. */
export interface MfaRequest {
  /** The current session, if any. */
  session?: MfaSession | null;
  /** The operation being performed (matched against `options.operations`). */
  operation?: string;
}

/** Standard JSON error body returned when MFA is not satisfied. */
export interface MfaErrorResponse {
  error: string;
  code: 'MFA_REQUIRED' | 'MFA_VERIFY_REQUIRED';
}

/** Result of the MFA enforcement check. */
export interface MfaCheckResult {
  /** Whether the request may proceed. */
  allowed: boolean;
  /** HTTP status code (403 when blocked, undefined when allowed). */
  status?: number;
  /** Error body (present only when blocked). */
  body?: MfaErrorResponse;
}

// =============================================================================
// Middleware
// =============================================================================

const DEFAULT_ROLES = ['admin'];

/**
 * Create an MFA enforcement checker.
 *
 * Returns a function that inspects a request's session and determines
 * whether MFA requirements are satisfied. Consumers are responsible
 * for translating the result into their framework's response format
 * (Hono, Express, Next.js, etc.).
 *
 * @param options - Roles and operations that require MFA
 * @returns A check function that evaluates MFA requirements
 *
 * @example
 * ```ts
 * const checkMfa = requireMfa({ roles: ['admin'], operations: ['delete_user'] });
 *
 * // In a Hono route:
 * app.delete('/users/:id', async (c) => {
 *   const result = checkMfa({ session: c.get('session'), operation: 'delete_user' });
 *   if (!result.allowed) {
 *     return c.json(result.body, result.status);
 *   }
 *   // proceed...
 * });
 * ```
 */
export function requireMfa(
  options: MfaEnforcementOptions = {},
): (request: MfaRequest) => MfaCheckResult {
  const requiredRoles = options.roles ?? DEFAULT_ROLES;
  const requiredOperations = options.operations ?? [];

  return (request: MfaRequest): MfaCheckResult => {
    const session = request.session;
    if (!session) {
      // No session — nothing to enforce (auth middleware handles this)
      return { allowed: true };
    }

    const user = session.user;

    // Determine if MFA is required for this request
    const roleRequiresMfa = requiredRoles.includes(user.role);
    const operationRequiresMfa =
      request.operation !== undefined && requiredOperations.includes(request.operation);

    if (!roleRequiresMfa && !operationRequiresMfa) {
      return { allowed: true };
    }

    // MFA is required but not enabled on the account
    if (!user.mfaEnabled) {
      return {
        allowed: false,
        status: 403,
        body: {
          error: 'MFA required',
          code: 'MFA_REQUIRED',
        },
      };
    }

    // MFA is enabled but not verified in this session
    if (!user.mfaVerified) {
      return {
        allowed: false,
        status: 403,
        body: {
          error: 'MFA verification required',
          code: 'MFA_VERIFY_REQUIRED',
        },
      };
    }

    return { allowed: true };
  };
}
