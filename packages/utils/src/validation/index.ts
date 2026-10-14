/**
 * Validation utilities and schemas
 *
 * Shared validation schemas and utilities for use across the monorepo
 */

export { type Password, passwordSchema } from './password-schema.js';
export {
  ADMIN_ROLES,
  canAdministerAllContent,
  canManageSiteContent,
  hasAnyRole,
  hasRole,
  isAdmin,
  isAdminRole,
  isPlatformSuperAdmin,
  isSuperAdmin,
  PLATFORM_ROLE_LADDER,
  type PlatformAuthUser,
  type PlatformLadderRole,
  type PlatformPosture,
  platformPosture,
  platformRoleRank,
  type RoleCarrier,
  type RoleSubject,
} from './platform-roles.js';
