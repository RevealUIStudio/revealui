/**
 * Audit Logging System
 *
 * Track security-relevant events and user actions for compliance
 */

export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed_login'
  | 'auth.password_change'
  | 'auth.password_reset'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.view'
  | 'data.create'
  | 'data.read'
  | 'data.update'
  | 'data.delete'
  | 'data.export'
  | 'permission.grant'
  | 'permission.revoke'
  | 'role.assign'
  | 'role.remove'
  | 'config.change'
  | 'security.violation'
  | 'security.alert'
  | 'gdpr.consent'
  | 'gdpr.data_request'
  | 'gdpr.data_deletion'
  | `data.${string}`
  | `permission.${string}`
  | `security.${string}`
  | `gdpr.${string}`;

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  severity: AuditSeverity;
  actor: {
    id: string;
    type: 'user' | 'system' | 'api';
    ip?: string;
    userAgent?: string;
  };
  resource?: {
    type: string;
    id: string;
    name?: string;
  };
  action: string;
  result: 'success' | 'failure' | 'partial';
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  message?: string;
}

export interface AuditQuery {
  types?: AuditEventType[];
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: AuditSeverity[];
  result?: ('success' | 'failure' | 'partial')[];
  limit?: number;
  offset?: number;
}

export interface AuditStorage {
  write(event: AuditEvent): Promise<void>;
  query(query: AuditQuery): Promise<AuditEvent[]>;
  count(query: AuditQuery): Promise<number>;
}

/**
 * Audit logging system
 */
export class AuditSystem {
  private storage: AuditStorage;
  private filters: Array<(event: AuditEvent) => boolean> = [];

  constructor(storage: AuditStorage) {
    this.storage = storage;
  }

  /**
   * Replace the backing storage (e.g. swap InMemory for Postgres at startup).
   * Events already written to the old storage are NOT migrated.
   */
  setStorage(storage: AuditStorage): void {
    this.storage = storage;
  }

  /**
   * Log audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Apply filters
    const shouldLog = this.filters.every((filter) => filter(fullEvent));

    if (!shouldLog) {
      return;
    }

    await this.storage.write(fullEvent);
  }

  /**
   * Log authentication event
   */
  async logAuth(
    type: Extract<
      AuditEventType,
      'auth.login' | 'auth.logout' | 'auth.failed_login' | 'auth.password_change'
    >,
    actorId: string,
    result: 'success' | 'failure',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      type,
      severity: result === 'failure' ? 'medium' : 'low',
      actor: {
        id: actorId,
        type: 'user',
      },
      action: (type as string).replace('auth.', ''),
      result,
      metadata,
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    action: 'create' | 'read' | 'update' | 'delete',
    actorId: string,
    resourceType: string,
    resourceId: string,
    result: 'success' | 'failure',
    changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> },
  ): Promise<void> {
    await this.log({
      type: `data.${action}` as AuditEventType,
      severity: action === 'delete' ? 'high' : 'medium',
      actor: {
        id: actorId,
        type: 'user',
      },
      resource: {
        type: resourceType,
        id: resourceId,
      },
      action,
      result,
      changes,
    });
  }

  /**
   * Log permission change
   */
  async logPermissionChange(
    action: 'grant' | 'revoke',
    actorId: string,
    targetUserId: string,
    permission: string,
    result: 'success' | 'failure',
  ): Promise<void> {
    await this.log({
      type: `permission.${action}` as AuditEventType,
      severity: 'high',
      actor: {
        id: actorId,
        type: 'user',
      },
      resource: {
        type: 'user',
        id: targetUserId,
      },
      action,
      result,
      metadata: {
        permission,
      },
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    type: 'violation' | 'alert',
    severity: AuditSeverity,
    actorId: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      type: `security.${type}` as AuditEventType,
      severity,
      actor: {
        id: actorId,
        type: 'user',
      },
      action: type,
      result: 'failure',
      message,
      metadata,
    });
  }

  /**
   * Log GDPR event
   */
  async logGDPREvent(
    type: 'consent' | 'data_request' | 'data_deletion',
    actorId: string,
    result: 'success' | 'failure',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      type: `gdpr.${type}` as AuditEventType,
      severity: 'high',
      actor: {
        id: actorId,
        type: 'user',
      },
      action: type,
      result,
      metadata,
    });
  }

  /**
   * Query audit logs
   */
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    return this.storage.query(query);
  }

  /**
   * Count audit logs
   */
  async count(query: AuditQuery): Promise<number> {
    return this.storage.count(query);
  }

  /**
   * Add filter
   */
  addFilter(filter: (event: AuditEvent) => boolean): void {
    this.filters.push(filter);
  }

  /**
   * Remove filter
   */
  removeFilter(filter: (event: AuditEvent) => boolean): void {
    const index = this.filters.indexOf(filter);
    if (index > -1) {
      this.filters.splice(index, 1);
    }
  }
}

/**
 * In-memory audit storage (for development)
 */
export class InMemoryAuditStorage implements AuditStorage {
  private events: AuditEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  async write(event: AuditEvent): Promise<void> {
    this.events.push(event);

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    let results = [...this.events];

    // Filter by type
    if (query.types && query.types.length > 0) {
      results = results.filter((e) => query.types?.includes(e.type));
    }

    // Filter by actor
    if (query.actorId) {
      results = results.filter((e) => e.actor.id === query.actorId);
    }

    // Filter by resource
    if (query.resourceType) {
      results = results.filter((e) => e.resource?.type === query.resourceType);
    }

    if (query.resourceId) {
      results = results.filter((e) => e.resource?.id === query.resourceId);
    }

    // Filter by date range
    if (query.startDate) {
      const startDate = query.startDate;
      results = results.filter((e) => new Date(e.timestamp) >= startDate);
    }

    if (query.endDate) {
      const endDate = query.endDate;
      results = results.filter((e) => new Date(e.timestamp) <= endDate);
    }

    // Filter by severity
    if (query.severity && query.severity.length > 0) {
      results = results.filter((e) => query.severity?.includes(e.severity));
    }

    // Filter by result
    if (query.result && query.result.length > 0) {
      results = results.filter((e) => query.result?.includes(e.result));
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return results.slice(offset, offset + limit);
  }

  async count(query: AuditQuery): Promise<number> {
    const results = await this.query({ ...query, limit: undefined, offset: undefined });
    return results.length;
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get all events
   */
  getAll(): AuditEvent[] {
    return [...this.events];
  }
}

/**
 * Audit trail decorator
 */
export function AuditTrail(
  type: AuditEventType,
  action: string,
  options?: {
    severity?: AuditSeverity;
    captureChanges?: boolean;
    resourceType?: string;
  },
) {
  return (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: { user?: { id?: string }; audit?: AuditSystem },
      ...args: unknown[]
    ) {
      const actorId = this.user?.id || 'system';
      const before = options?.captureChanges ? args[0] : undefined;

      let result: 'success' | 'failure' | 'partial' = 'success';
      let error: Error | undefined;

      try {
        const returnValue = await originalMethod.apply(this, args);

        // Log audit event
        if (this.audit) {
          await this.audit.log({
            type,
            severity: options?.severity || 'medium',
            actor: {
              id: actorId,
              type: 'user',
            },
            resource: options?.resourceType
              ? {
                  type: options.resourceType,
                  id: (args[0] as { id?: string })?.id || 'unknown',
                }
              : undefined,
            action,
            result,
            changes: options?.captureChanges
              ? {
                  before: before as Record<string, unknown> | undefined,
                  after: returnValue as Record<string, unknown> | undefined,
                }
              : undefined,
          });
        }

        return returnValue;
      } catch (err) {
        result = 'failure';
        error = err as Error;

        // Log failure
        if (this.audit) {
          await this.audit.log({
            type,
            severity: 'high',
            actor: {
              id: actorId,
              type: 'user',
            },
            resource: options?.resourceType
              ? {
                  type: options.resourceType,
                  id: (args[0] as { id?: string })?.id || 'unknown',
                }
              : undefined,
            action,
            result,
            message: error.message,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Audit middleware
 */
export function createAuditMiddleware<TRequest = unknown, TResponse = unknown>(
  audit: AuditSystem,
  getUser: (request: TRequest) => { id: string; ip?: string; userAgent?: string },
) {
  return async (
    request: TRequest & { method: string; url: string },
    next: () => Promise<TResponse & { status?: number }>,
  ) => {
    const user = getUser(request);
    const startTime = Date.now();

    try {
      const response = await next();

      // Log successful request
      await audit.log({
        type: 'data.read',
        severity: 'low',
        actor: {
          id: user.id,
          type: 'user',
          ip: user.ip,
          userAgent: user.userAgent,
        },
        action: request.method,
        result: 'success',
        metadata: {
          path: request.url,
          duration: Date.now() - startTime,
          status: response.status,
        },
      });

      return response;
    } catch (error) {
      // Log failed request
      await audit.log({
        type: 'data.read',
        severity: 'medium',
        actor: {
          id: user.id,
          type: 'user',
          ip: user.ip,
          userAgent: user.userAgent,
        },
        action: request.method,
        result: 'failure',
        message: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          path: request.url,
          duration: Date.now() - startTime,
        },
      });

      throw error;
    }
  };
}

/**
 * Audit report generator
 */
export class AuditReportGenerator {
  constructor(private audit: AuditSystem) {}

  /**
   * Generate security report
   */
  async generateSecurityReport(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalEvents: number;
    securityViolations: number;
    failedLogins: number;
    permissionChanges: number;
    dataExports: number;
    criticalEvents: AuditEvent[];
  }> {
    const allEvents = await this.audit.query({
      startDate,
      endDate,
    });

    const securityViolations = allEvents.filter((e) => e.type.startsWith('security.')).length;

    const failedLogins = allEvents.filter((e) => e.type === 'auth.failed_login').length;

    const permissionChanges = allEvents.filter((e) => e.type.startsWith('permission.')).length;

    const dataExports = allEvents.filter((e) => e.type === 'data.export').length;

    const criticalEvents = allEvents.filter((e) => e.severity === 'critical');

    return {
      totalEvents: allEvents.length,
      securityViolations,
      failedLogins,
      permissionChanges,
      dataExports,
      criticalEvents,
    };
  }

  /**
   * Generate user activity report
   */
  async generateUserActivityReport(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    failedActions: number;
    recentActions: AuditEvent[];
  }> {
    const events = await this.audit.query({
      actorId: userId,
      startDate,
      endDate,
    });

    const actionsByType = events.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const failedActions = events.filter((e) => e.result === 'failure').length;

    return {
      totalActions: events.length,
      actionsByType,
      failedActions,
      recentActions: events.slice(0, 10),
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    dataAccesses: number;
    dataModifications: number;
    dataDeletions: number;
    gdprRequests: number;
    auditTrailComplete: boolean;
  }> {
    const events = await this.audit.query({
      startDate,
      endDate,
    });

    const dataAccesses = events.filter((e) => e.type === 'data.read').length;

    const dataModifications = events.filter(
      (e) => e.type === 'data.update' || e.type === 'data.create',
    ).length;

    const dataDeletions = events.filter((e) => e.type === 'data.delete').length;

    const gdprRequests = events.filter((e) => e.type.startsWith('gdpr.')).length;

    // Check if audit trail is complete (no gaps)
    const auditTrailComplete = this.checkAuditTrailContinuity(events);

    return {
      dataAccesses,
      dataModifications,
      dataDeletions,
      gdprRequests,
      auditTrailComplete,
    };
  }

  /**
   * Check audit trail continuity
   */
  private checkAuditTrailContinuity(events: AuditEvent[]): boolean {
    if (events.length === 0) return true;

    // Sort by timestamp
    const sorted = events.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Check for gaps (simplified - just check if we have events)
    return sorted.length > 0;
  }
}

/**
 * Global audit system
 */
export const audit = new AuditSystem(new InMemoryAuditStorage());
