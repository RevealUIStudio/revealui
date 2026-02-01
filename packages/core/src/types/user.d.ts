/**
 * RevealUI User Types
 *
 * Defines user interfaces and related authentication types.
 *
 * @module @revealui/core/types/user
 */
/** Core user interface */
export interface RevealUser {
    id: string | number;
    email: string;
    roles?: string[];
    firstName?: string;
    lastName?: string;
    password?: string;
    createdAt?: string;
    updatedAt?: string;
    lastLoggedInTenant?: string;
    purchases?: unknown[];
    tenants?: unknown[];
    [key: string]: unknown;
}
/** Alias for consistency */
export type User = RevealUser;
/** Extended user with RevealUI features */
export interface RevealUIUser extends RevealUser {
    tenants?: string[];
    revealUI?: {
        preferences?: Record<string, unknown>;
        lastLogin?: string;
        isSuperAdmin?: boolean;
    };
}
/** Tenant configuration */
export interface RevealUITenant {
    id: string;
    name: string;
    domain: string;
    settings: Record<string, unknown>;
}
export type RevealUIPermission = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'admin';
export interface Permission {
    create?: boolean | Record<string, unknown>;
    read?: boolean | Record<string, unknown>;
    update?: boolean | Record<string, unknown>;
    delete?: boolean | Record<string, unknown>;
}
//# sourceMappingURL=user.d.ts.map