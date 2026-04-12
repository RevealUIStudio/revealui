/**
 * Authorization System
 *
 * Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC)
 */

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  inherits?: string[];
}

export interface Policy {
  id: string;
  name: string;
  effect: 'allow' | 'deny';
  resources: string[];
  actions: string[];
  conditions?: PolicyCondition[];
  priority?: number;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface AuthorizationContext {
  user: {
    id: string;
    roles: string[];
    attributes?: Record<string, unknown>;
  };
  resource?: {
    type: string;
    id?: string;
    owner?: string;
    attributes?: Record<string, unknown>;
  };
  environment?: {
    time?: Date;
    ip?: string;
    userAgent?: string;
  };
}

/**
 * Authorization system
 */
export class AuthorizationSystem {
  private roles: Map<string, Role> = new Map();
  private policies: Map<string, Policy> = new Map();

  /**
   * Register role
   */
  registerRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  /**
   * Get role
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  /**
   * Register policy
   */
  registerPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Check if user has permission (RBAC)
   */
  hasPermission(userRoles: string[], resource: string, action: string): boolean {
    // Get all permissions for user's roles
    const permissions = this.getUserPermissions(userRoles);

    // Check if any permission matches
    return permissions.some(
      (permission) =>
        this.matchesResource(permission.resource, resource) &&
        this.matchesAction(permission.action, action),
    );
  }

  /**
   * Check access with policies (ABAC)
   */
  checkAccess(
    context: AuthorizationContext,
    resource: string,
    action: string,
  ): { allowed: boolean; reason?: string } {
    // Check RBAC first
    if (this.hasPermission(context.user.roles, resource, action)) {
      return { allowed: true };
    }

    // Check policies
    const applicablePolicies = this.getApplicablePolicies(resource, action, context);

    // Sort by priority (higher priority first)
    applicablePolicies.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Apply first matching policy
    for (const policy of applicablePolicies) {
      if (this.evaluateConditions(policy.conditions || [], context)) {
        return {
          allowed: policy.effect === 'allow',
          reason: policy.effect === 'deny' ? `Denied by policy: ${policy.name}` : undefined,
        };
      }
    }

    return { allowed: false, reason: 'No matching policy' };
  }

  /**
   * Get all permissions for roles
   */
  private getUserPermissions(roleIds: string[]): Permission[] {
    const permissions: Permission[] = [];
    const visited = new Set<string>();

    const addRolePermissions = (roleId: string) => {
      if (visited.has(roleId)) return;

      visited.add(roleId);

      const role = this.roles.get(roleId);
      if (!role) return;

      // Add role permissions
      permissions.push(...role.permissions);

      // Add inherited permissions
      if (role.inherits) {
        role.inherits.forEach((inheritedRoleId) => {
          addRolePermissions(inheritedRoleId);
        });
      }
    };

    roleIds.forEach(addRolePermissions);

    return permissions;
  }

  /**
   * Get applicable policies
   */
  private getApplicablePolicies(
    resource: string,
    action: string,
    _context: AuthorizationContext,
  ): Policy[] {
    return Array.from(this.policies.values()).filter((policy) => {
      // Check if resource matches
      const resourceMatches = policy.resources.some((r) => this.matchesResource(r, resource));

      // Check if action matches
      const actionMatches = policy.actions.some((a) => this.matchesAction(a, action));

      return resourceMatches && actionMatches;
    });
  }

  /**
   * Match resource pattern
   */
  private matchesResource(pattern: string, resource: string): boolean {
    if (pattern === '*') return true;
    if (pattern === resource) return true;

    // Convert glob pattern to regex (escape backslashes first)
    const regex = new RegExp(
      `^${pattern.replace(/\\/g, '\\\\').replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
    );

    return regex.test(resource);
  }

  /**
   * Match action pattern
   */
  private matchesAction(pattern: string, action: string): boolean {
    if (pattern === '*') return true;
    if (pattern === action) return true;

    // Support wildcards like "read:*" (escape backslashes first)
    const regex = new RegExp(
      `^${pattern.replace(/\\/g, '\\\\').replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
    );

    return regex.test(action);
  }

  /**
   * Evaluate policy conditions
   */
  private evaluateConditions(
    conditions: PolicyCondition[],
    context: AuthorizationContext,
  ): boolean {
    return conditions.every((condition) => {
      const value = this.getContextValue(condition.field, context);
      return this.evaluateCondition(condition, value);
    });
  }

  /**
   * Get value from context
   */
  private getContextValue(field: string, context: AuthorizationContext): unknown {
    const parts = field.split('.');

    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: PolicyCondition, value: unknown): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;

      case 'ne':
        return value !== condition.value;

      case 'gt':
        return typeof value === 'number' && value > (condition.value as number);

      case 'gte':
        return typeof value === 'number' && value >= (condition.value as number);

      case 'lt':
        return typeof value === 'number' && value < (condition.value as number);

      case 'lte':
        return typeof value === 'number' && value <= (condition.value as number);

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      case 'contains':
        return (
          typeof value === 'string' &&
          typeof condition.value === 'string' &&
          value.includes(condition.value)
        );

      default:
        return false;
    }
  }

  /**
   * Check if user owns resource
   */
  ownsResource(userId: string, resource: { owner?: string }): boolean {
    return resource.owner === userId;
  }

  /**
   * Clear all roles and policies
   */
  clear(): void {
    this.roles.clear();
    this.policies.clear();
  }
}

/**
 * Global authorization instance
 */
export const authorization = new AuthorizationSystem();

/**
 * Common roles — aligned with DB schema (`users.role` column)
 * and `UserRoleSchema` in @revealui/contracts.
 *
 * Values: owner | admin | editor | viewer | agent | contributor
 */
export const CommonRoles: Record<string, Role> = {
  owner: {
    id: 'owner',
    name: 'Owner',
    description: 'Full control — inherits admin',
    permissions: [{ resource: '*', action: '*' }],
    inherits: ['admin'],
  },
  admin: {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    permissions: [{ resource: '*', action: '*' }],
  },
  editor: {
    id: 'editor',
    name: 'Editor',
    description: 'Can read and modify content',
    permissions: [
      { resource: 'content', action: 'read' },
      { resource: 'content', action: 'create' },
      { resource: 'content', action: 'update' },
      { resource: 'profile', action: 'read' },
      { resource: 'profile', action: 'update' },
      { resource: 'sites', action: 'read' },
      { resource: 'marketplace', action: 'read' },
    ],
  },
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      { resource: 'content', action: 'read' },
      { resource: 'profile', action: 'read' },
      { resource: 'sites', action: 'read' },
      { resource: 'public', action: 'read' },
    ],
  },
  agent: {
    id: 'agent',
    name: 'AI Agent',
    description: 'Can execute tasks and read content',
    permissions: [
      { resource: 'tasks', action: 'create' },
      { resource: 'tasks', action: 'read' },
      { resource: 'content', action: 'read' },
      { resource: 'rag', action: 'read' },
      { resource: 'rag', action: 'create' },
    ],
  },
  contributor: {
    id: 'contributor',
    name: 'Contributor',
    description: 'Can suggest changes — create drafts but not publish or delete',
    permissions: [
      { resource: 'content', action: 'read' },
      { resource: 'content', action: 'create' },
      { resource: 'profile', action: 'read' },
      { resource: 'profile', action: 'update' },
    ],
  },
} satisfies Record<string, Role>;

/**
 * Permission builder
 */
export class PermissionBuilder {
  private permission: Partial<Permission> = {};

  resource(resource: string): this {
    this.permission.resource = resource;
    return this;
  }

  action(action: string): this {
    this.permission.action = action;
    return this;
  }

  conditions(conditions: Record<string, unknown>): this {
    this.permission.conditions = conditions;
    return this;
  }

  build(): Permission {
    if (!(this.permission.resource && this.permission.action)) {
      throw new Error('Resource and action are required');
    }

    return this.permission as Permission;
  }
}

/**
 * Policy builder
 */
export class PolicyBuilder {
  private policy: Partial<Policy> = {
    effect: 'allow',
    resources: [],
    actions: [],
    conditions: [],
  };

  id(id: string): this {
    this.policy.id = id;
    return this;
  }

  name(name: string): this {
    this.policy.name = name;
    return this;
  }

  allow(): this {
    this.policy.effect = 'allow';
    return this;
  }

  deny(): this {
    this.policy.effect = 'deny';
    return this;
  }

  resources(...resources: string[]): this {
    this.policy.resources = resources;
    return this;
  }

  actions(...actions: string[]): this {
    this.policy.actions = actions;
    return this;
  }

  condition(field: string, operator: PolicyCondition['operator'], value: unknown): this {
    if (!this.policy.conditions) {
      this.policy.conditions = [];
    }

    this.policy.conditions.push({ field, operator, value });
    return this;
  }

  priority(priority: number): this {
    this.policy.priority = priority;
    return this;
  }

  build(): Policy {
    if (!(this.policy.id && this.policy.name)) {
      throw new Error('ID and name are required');
    }

    return this.policy as Policy;
  }
}

/**
 * Authorization decorators
 */
export function RequirePermission(resource: string, action: string) {
  return (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (this: { user?: { roles?: string[] } }, ...args: unknown[]) {
      const userRoles = this.user?.roles || [];

      if (!authorization.hasPermission(userRoles, resource, action)) {
        throw new Error(`Permission denied: ${resource}:${action}`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

export function RequireRole(requiredRole: string) {
  return (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (this: { user?: { roles?: string[] } }, ...args: unknown[]) {
      const userRoles = this.user?.roles || [];

      if (!userRoles.includes(requiredRole)) {
        throw new Error(`Role required: ${requiredRole}`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Authorization middleware
 */
export function createAuthorizationMiddleware<TRequest = unknown>(
  getUser: (request: TRequest) => { id: string; roles: string[] },
  resource: string,
  action: string,
) {
  return (request: TRequest, next: () => Promise<unknown>) => {
    const user = getUser(request);

    if (!authorization.hasPermission(user.roles, resource, action)) {
      throw new Error(`Permission denied: ${resource}:${action}`);
    }

    return next();
  };
}

/**
 * Resource ownership check
 */
export function canAccessResource(
  userId: string,
  userRoles: string[],
  resource: {
    type: string;
    id?: string;
    owner?: string;
  },
  action: string,
): boolean {
  // Check if user has permission
  if (authorization.hasPermission(userRoles, resource.type, action)) {
    return true;
  }

  // Check if user owns the resource
  if (authorization.ownsResource(userId, resource)) {
    return true;
  }

  return false;
}

/**
 * Attribute-based access control helper
 */
export function checkAttributeAccess(
  context: AuthorizationContext,
  resource: string,
  action: string,
  requiredAttributes?: Record<string, unknown>,
): boolean {
  // Check basic permission
  const { allowed } = authorization.checkAccess(context, resource, action);

  if (!allowed) {
    return false;
  }

  // Check required attributes
  if (requiredAttributes) {
    const userAttributes = context.user.attributes || {};

    return Object.entries(requiredAttributes).every(
      ([key, value]) => userAttributes[key] === value,
    );
  }

  return true;
}

/**
 * Permission cache for performance
 */
export class PermissionCache {
  private cache: Map<string, { allowed: boolean; expiresAt: number }> = new Map();
  private ttl: number;
  private maxEntries: number;

  constructor(ttl: number = 300000, maxEntries: number = 10_000) {
    // 5 minutes default, 10k max entries
    this.ttl = ttl;
    this.maxEntries = maxEntries;
  }

  /**
   * Get cached permission
   */
  get(userId: string, resource: string, action: string): boolean | undefined {
    const key = this.getCacheKey(userId, resource, action);
    const cached = this.cache.get(key);

    if (!cached) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return cached.allowed;
  }

  /**
   * Set cached permission
   */
  set(userId: string, resource: string, action: string, allowed: boolean): void {
    const key = this.getCacheKey(userId, resource, action);

    // Evict expired entries when approaching max size
    if (this.cache.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (now > v.expiresAt) this.cache.delete(k);
      }
      // If still over limit after purge, drop oldest entries (FIFO via Map insertion order)
      if (this.cache.size >= this.maxEntries) {
        const excess = this.cache.size - this.maxEntries + 1;
        const keys = this.cache.keys();
        for (let i = 0; i < excess; i++) {
          const next = keys.next();
          if (!next.done) this.cache.delete(next.value);
        }
      }
    }

    this.cache.set(key, {
      allowed,
      expiresAt: Date.now() + this.ttl,
    });
  }

  /**
   * Clear cache for user
   */
  clearUser(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache key
   */
  private getCacheKey(userId: string, resource: string, action: string): string {
    return `${userId}:${resource}:${action}`;
  }
}

/**
 * Global permission cache
 */
export const permissionCache = new PermissionCache();
