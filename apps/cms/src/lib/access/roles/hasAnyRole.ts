import type { RevealUser } from "@revealui/core";
import type { Role } from "../permissions/roles";
import { hasRole } from "./hasRole";

export enum AccessLevel {
	Customer = 1,
	User = 2,
	Viewer = 3,
	Marketer = 4,
	SupportAgent = 5,
	ProjectManager = 6,
	ContentManager = 7,
	UserAdmin = 8,
	TenantAdmin = 9,
	TenantSuperAdmin = 10,
	UserSuperAdmin = 11,
}

export function hasAnyRole(user: RevealUser, roles: Role[]): boolean {
	return hasRole(user, roles);
}
