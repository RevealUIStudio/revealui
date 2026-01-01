import type {
  RevealUI,
  RevealUIConfig,
  RevealUICollection,
  RevealUIField,
  RevealUIContext,
  RevealUIAccessRule,
  RevealUIBlock,
  RevealUIUser,
  RevealUIDocument,
  RevealUITenant
} from './types/index';

// Main RevealUI class - framework abstraction over Payload
export class RevealUI {
  private config: RevealUIConfig;
  private context: RevealUIContext;

  constructor(config: RevealUIConfig, context?: Partial<RevealUIContext>) {
    this.config = config;
    this.context = {
      permissions: [],
      theme: 'default',
      ...context
    };
  }

  // Initialize the framework
  async init(): Promise<void> {
    // Framework initialization logic
    // This would set up the underlying CMS system
    console.log('RevealUI initialized with config:', this.config);
  }

  // Collection operations
  async find(collection: string, options?: any): Promise<RevealUIDocument[]> {
    // Abstract the underlying CMS query
    // This would delegate to Payload or another CMS
    return [];
  }

  async findById(collection: string, id: string): Promise<RevealUIDocument | null> {
    // Abstract the underlying CMS query
    return null;
  }

  async create(collection: string, data: Record<string, unknown>): Promise<RevealUIDocument> {
    // Abstract the underlying CMS create operation
    const document: RevealUIDocument = {
      id: 'generated-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
      revealUI: {
        tenantId: this.context.tenant?.id,
        createdBy: this.context.user?.id,
        version: 1,
        auditLog: [{
          timestamp: new Date().toISOString(),
          userId: this.context.user?.id || 'system',
          action: 'create',
          changes: {}
        }]
      }
    };

    return document;
  }

  async update(collection: string, id: string, data: Record<string, unknown>): Promise<RevealUIDocument | null> {
    // Abstract the underlying CMS update operation
    return null;
  }

  async delete(collection: string, id: string): Promise<boolean> {
    // Abstract the underlying CMS delete operation
    return true;
  }

  // Context management
  setContext(context: Partial<RevealUIContext>): void {
    this.context = { ...this.context, ...context };
  }

  getContext(): RevealUIContext {
    return this.context;
  }

  // Permission checking
  hasPermission(permission: string): boolean {
    return this.context.permissions.includes(permission as any) ||
           this.context.permissions.includes('admin');
  }

  // Tenant operations
  switchTenant(tenantId: string): void {
    // Switch the active tenant context
    this.context.tenant = {
      id: tenantId,
      name: `Tenant ${tenantId}`,
      domain: `${tenantId}.example.com`
    };
  }
}

// Factory function to create RevealUI instance
export function createRevealUI(config: RevealUIConfig, context?: Partial<RevealUIContext>): RevealUI {
  return new RevealUI(config, context);
}

// Collection builder functions
export function createRevealUICollection(options: {
  slug: string;
  fields: RevealUIField[];
  revealUI?: RevealUICollection['revealUI'];
  access?: RevealUICollection['access'];
}): RevealUICollection {
  return {
    slug: options.slug,
    fields: options.fields,
    revealUI: {
      tenantScoped: false,
      auditLog: false,
      permissions: ['read', 'write'],
      hooks: {},
      ...options.revealUI
    },
    access: options.access
  };
}

// Field builder functions
export function createRevealUIField(options: {
  name: string;
  type: RevealUIField['type'];
  label?: string;
  required?: boolean;
  revealUI?: RevealUIField['revealUI'];
  admin?: RevealUIField['admin'];
  validate?: RevealUIField['validate'];
}): RevealUIField {
  return {
    name: options.name,
    type: options.type,
    label: options.label,
    required: options.required,
    revealUI: {
      searchable: false,
      permissions: ['read', 'write'],
      tenantScoped: false,
      auditLog: false,
      validation: [],
      ...options.revealUI
    },
    admin: options.admin,
    validate: options.validate
  };
}

// Block builder functions
export function createRevealUIBlock(options: {
  slug: string;
  fields: RevealUIField[];
  revealUI?: RevealUIBlock['revealUI'];
  labels?: RevealUIBlock['labels'];
}): RevealUIBlock {
  return {
    slug: options.slug,
    fields: options.fields,
    revealUI: {
      category: 'content',
      icon: 'block',
      permissions: ['read', 'write'],
      tenantScoped: false,
      ...options.revealUI
    },
    labels: options.labels
  };
}

// Access rule builder functions
export function createRevealUIAccessRule(options: {
  tenant?: string;
  user?: string;
  permissions?: string[];
  condition?: (context: any) => boolean | any;
}): RevealUIAccessRule {
  return {
    tenant: options.tenant,
    user: options.user,
    permissions: options.permissions as any,
    condition: options.condition
  };
}

// React hook for using RevealUI
export function useRevealUI(): RevealUIContext {
  // This would be implemented with React context
  return {
    permissions: ['read'],
    theme: 'default'
  };
}

// Higher-order component for RevealUI access control
export function withRevealUIAccess<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermissions: string[]
): React.ComponentType<P> {
  return function RevealUIAccessWrapper(props: P) {
    // This would check permissions and conditionally render
    return <WrappedComponent {...props} />;
  };
}