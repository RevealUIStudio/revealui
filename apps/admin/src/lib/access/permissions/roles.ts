import type { Permission } from '@revealui/core';

export enum Role {
  TenantSuperAdmin = 'tenant-super-admin',
  TenantAdmin = 'tenant-admin',
  UserAdmin = 'admin',
  UserSuperAdmin = 'super-admin',
  SupportAgent = 'support-agent',
  BillingManager = 'billing-manager',
  ComplianceOfficer = 'compliance-officer',
  ContentManager = 'content-manager',
  ProjectManager = 'project-manager',
  Viewer = 'viewer',
  Marketer = 'marketer',
  APIConsumer = 'api-consumer',
  Trainer = 'trainer',
  Moderator = 'moderator',
  User = 'user',
  Customer = 'customer',
}

export interface RolePermission extends Permission {
  name: string;
  level: number; // Level defines priority or importance of the permission
  permission: boolean;
}

const Permissions = {
  ManageUsers: { name: 'manage-users', level: 8, permission: true },
  ManageBilling: { name: 'manage-billing', level: 9, permission: true },
  ViewReports: { name: 'view-reports', level: 5, permission: true },
  ManageContent: { name: 'manage-content', level: 7, permission: true },
  ApprovePosts: { name: 'approve-posts', level: 6, permission: true },
  AccessAPI: { name: 'access-api', level: 4, permission: true },
};

const RolePermissions: Record<Role, RolePermission[]> = {
  [Role.TenantSuperAdmin]: [
    Permissions.ManageUsers,
    Permissions.ManageBilling,
    Permissions.ManageContent,
  ],
  [Role.TenantAdmin]: [Permissions.ManageUsers, Permissions.ManageContent],
  [Role.UserAdmin]: [Permissions.ManageUsers],
  [Role.UserSuperAdmin]: [Permissions.ManageUsers, Permissions.ManageBilling],
  [Role.ContentManager]: [Permissions.ManageContent],
  [Role.ProjectManager]: [Permissions.ViewReports],
  [Role.APIConsumer]: [Permissions.AccessAPI],
  [Role.Marketer]: [Permissions.ViewReports],
  [Role.Viewer]: [],
  [Role.Customer]: [],
  [Role.SupportAgent]: [Permissions.ViewReports],
  [Role.BillingManager]: [Permissions.ManageBilling],
  [Role.ComplianceOfficer]: [Permissions.ViewReports],
  [Role.Moderator]: [Permissions.ApprovePosts],
  [Role.Trainer]: [Permissions.ManageContent],
  [Role.User]: [],
};

export default RolePermissions;
