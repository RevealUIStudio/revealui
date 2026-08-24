/**
 * Security Event Bridge  -  Connects auth events to the audit trail.
 *
 * Each function wraps an auth operation with structured audit logging
 * via the AuditSystem from @revealui/security/server. Uses lazy import to
 * avoid circular dependency issues at module load time.
 */

import { logger } from '@revealui/core/observability/logger';
import type { AuditEvent, AuditSystem } from '@revealui/security/server';
import { evaluateSecurityAlert } from './security-alerts.js';

type AuditEventInput = Omit<AuditEvent, 'id' | 'timestamp'>;

/**
 * Lazily resolve the global audit system from @revealui/security/server.
 * Returns null if the module cannot be loaded (e.g. in test environments
 * where @revealui/security/server is not available).
 */
async function getAudit(): Promise<AuditSystem | null> {
  try {
    const { audit } = await import('@revealui/security/server');
    return audit;
  } catch {
    return null;
  }
}

/**
 * Internal helper  -  logs an audit event best-effort. Silently skips when the
 * audit system is unavailable, and swallows (but logs) a write failure so the
 * operation being audited  -  e.g. a login  -  never fails because its audit
 * record could not be persisted.
 */
async function logAuditEvent(event: AuditEventInput): Promise<void> {
  const auditSystem = await getAudit();
  if (auditSystem) {
    try {
      await auditSystem.log(event);
    } catch (error) {
      logger.error('Failed to write audit event', error instanceof Error ? error : undefined, {
        type: event.type,
      });
    }
  }
  // Threshold alerts (failed logins, MFA disable, lockouts, …) — C11 WIRE
  await evaluateSecurityAlert(event);
}

/**
 * Record a successful login to the audit trail.
 *
 * @param userId - The authenticated user's ID
 * @param ip - Client IP address
 * @param userAgent - Client User-Agent header
 */
export async function auditLoginSuccess(
  userId: string,
  ip: string,
  userAgent: string,
): Promise<void> {
  await logAuditEvent({
    type: 'auth.login',
    severity: 'low',
    actor: { id: userId, type: 'user', ip, userAgent },
    action: 'login',
    result: 'success',
    message: 'User logged in successfully',
  });
}

/**
 * Record a failed login attempt to the audit trail.
 *
 * @param email - The email used in the failed attempt
 * @param ip - Client IP address
 * @param userAgent - Client User-Agent header
 * @param reason - Why the login failed (e.g. 'invalid_password', 'account_locked')
 */
export async function auditLoginFailure(
  email: string,
  ip: string,
  userAgent: string,
  reason: string,
): Promise<void> {
  await logAuditEvent({
    type: 'auth.failed_login',
    severity: 'medium',
    actor: { id: email, type: 'user', ip, userAgent },
    action: 'login',
    result: 'failure',
    message: `Login failed: ${reason}`,
    metadata: { email, reason },
  });
}

/**
 * Record a password change to the audit trail.
 *
 * @param userId - The user who changed their password
 * @param ip - Client IP address
 */
export async function auditPasswordChange(userId: string, ip: string): Promise<void> {
  await logAuditEvent({
    type: 'auth.password_change',
    severity: 'medium',
    actor: { id: userId, type: 'user', ip },
    action: 'password_change',
    result: 'success',
    message: 'Password changed',
  });
}

/**
 * Record a password reset request to the audit trail.
 *
 * @param email - The email for which a reset was requested
 * @param ip - Client IP address
 */
export async function auditPasswordReset(email: string, ip: string): Promise<void> {
  await logAuditEvent({
    type: 'auth.password_reset',
    severity: 'medium',
    actor: { id: email, type: 'user', ip },
    action: 'password_reset',
    result: 'success',
    message: 'Password reset requested',
    metadata: { email },
  });
}

/**
 * Record MFA being enabled on an account to the audit trail.
 *
 * @param userId - The user who enabled MFA
 * @param ip - Client IP address
 */
export async function auditMfaEnabled(userId: string, ip: string): Promise<void> {
  await logAuditEvent({
    type: 'auth.mfa_enabled',
    severity: 'medium',
    actor: { id: userId, type: 'user', ip },
    action: 'mfa_enabled',
    result: 'success',
    message: 'MFA enabled',
  });
}

/**
 * Record MFA being disabled on an account to the audit trail.
 *
 * @param userId - The user who disabled MFA
 * @param ip - Client IP address
 */
export async function auditMfaDisabled(userId: string, ip: string): Promise<void> {
  await logAuditEvent({
    type: 'auth.mfa_disabled',
    severity: 'high',
    actor: { id: userId, type: 'user', ip },
    action: 'mfa_disabled',
    result: 'success',
    message: 'MFA disabled',
  });
}

/**
 * Record a session revocation to the audit trail.
 *
 * @param userId - The user whose session was revoked
 * @param sessionId - The revoked session's ID
 * @param ip - Client IP address
 */
export async function auditSessionRevoked(
  userId: string,
  sessionId: string,
  ip: string,
): Promise<void> {
  await logAuditEvent({
    type: 'security.alert',
    severity: 'medium',
    actor: { id: userId, type: 'user', ip },
    action: 'session_revoked',
    result: 'success',
    message: 'Session revoked',
    metadata: { sessionId },
  });
}

/**
 * Record an account lockout to the audit trail.
 *
 * @param email - The locked account's email
 * @param ip - Client IP address
 * @param failedAttempts - Number of failed attempts that triggered the lockout
 */
export async function auditAccountLocked(
  email: string,
  ip: string,
  failedAttempts: number,
): Promise<void> {
  await logAuditEvent({
    type: 'security.alert',
    severity: 'high',
    actor: { id: email, type: 'user', ip },
    action: 'account_locked',
    result: 'failure',
    message: `Account locked after ${String(failedAttempts)} failed attempts`,
    metadata: { email, failedAttempts },
  });
}

/**
 * Structured fields required by GAP-464 / #449 Audit wiring.
 * `userId` may be absent on pre-JIT login failures.
 */
export interface SsoAuditContext {
  providerType?: string;
  accountId?: string;
  userId?: string;
  issuer?: string;
  providerId?: string;
  ip?: string;
  userAgent?: string;
}

function ssoMetadata(context: SsoAuditContext): Record<string, unknown> {
  return {
    providerType: context.providerType ?? null,
    accountId: context.accountId ?? null,
    userId: context.userId ?? null,
    issuer: context.issuer ?? null,
    providerId: context.providerId ?? null,
  };
}

/**
 * Record a successful Enterprise SSO login (OIDC or SAML ACS).
 * Persists via the audit door before the HTTP response returns.
 */
export async function auditSsoLoginSuccess(context: SsoAuditContext): Promise<void> {
  const actorId = context.userId ?? context.accountId ?? 'unknown';
  await logAuditEvent({
    type: 'sso_login_success',
    severity: 'low',
    actor: {
      id: actorId,
      type: 'user',
      ip: context.ip,
      userAgent: context.userAgent,
    },
    resource: context.providerId ? { type: 'sso_provider', id: context.providerId } : undefined,
    action: 'sso_login',
    result: 'success',
    message: 'SSO login succeeded',
    metadata: ssoMetadata(context),
  });
}

/**
 * Record a failed Enterprise SSO login attempt.
 * Persists via the audit door before the HTTP response returns.
 */
export async function auditSsoLoginFailure(
  context: SsoAuditContext & { reason: string },
): Promise<void> {
  const actorId = context.userId ?? context.accountId ?? 'unknown';
  await logAuditEvent({
    type: 'sso_login_failure',
    severity: 'medium',
    actor: {
      id: actorId,
      type: 'user',
      ip: context.ip,
      userAgent: context.userAgent,
    },
    resource: context.providerId ? { type: 'sso_provider', id: context.providerId } : undefined,
    action: 'sso_login',
    result: 'failure',
    message: `SSO login failed: ${context.reason}`,
    metadata: { ...ssoMetadata(context), reason: context.reason },
  });
}

/**
 * Record an SSO provider create / update / delete (or equivalent mapping change).
 * Persists via the audit door before the HTTP response returns.
 */
export async function auditSsoConfigChanged(
  context: SsoAuditContext & { action: string },
): Promise<void> {
  const actorId = context.userId ?? context.accountId ?? 'unknown';
  await logAuditEvent({
    type: 'sso_config_changed',
    severity: 'medium',
    actor: {
      id: actorId,
      type: 'user',
      ip: context.ip,
      userAgent: context.userAgent,
    },
    resource: context.providerId ? { type: 'sso_provider', id: context.providerId } : undefined,
    action: context.action,
    result: 'success',
    message: `SSO provider ${context.action}`,
    metadata: { ...ssoMetadata(context), action: context.action },
  });
}
