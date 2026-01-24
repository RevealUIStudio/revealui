import type { FieldAccess } from "@revealui/core";
import { Role } from "../permissions/roles";
import { hasRole } from "./hasRole";

// FieldAccess uses unknown as default, which is type-safe
export const isSuperAdmin: FieldAccess = async ({ req }) => {
	const user = req?.user;

	// If no user is present, deny access
	if (!user) {
		return false;
	}

	// hasRole accepts UserWithRoles which has index signature for compatibility
	return hasRole(user, [Role.UserSuperAdmin]);
};
