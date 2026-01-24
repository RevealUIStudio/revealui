import { Role } from "@/lib/access/permissions/roles";
import { checkUserRoles } from "../../../access/users/checkUserRoles";

export const adminsOrOrderedBy = ({ req }: { req: { user?: unknown } }) => {
	const user = req?.user as {
		id?: string | number;
		globalRoles?: string[];
		roles?: string[];
	} | null;

	if (!user) {
		return false;
	}

	// Pass the user as the first argument and the roles array as the second
	if (checkUserRoles(user, [Role.TenantSuperAdmin])) {
		return true;
	}

	// Allow access if the order was made by the logged-in user
	return {
		orderedBy: {
			equals: user.id,
		},
	};
};

// import {
//   checkUserRoles,
//   type UserRole,
// } from "../../../access/users/checkUserRoles";
// import type { Access } from "@revealui/core";

// export const adminsOrOrderedBy: Access = ({ req }) => {
//   if (checkUserRoles(["user-super-admin"], user as UserRole)) {
//     return true;
//   }

//   return {
//     orderedBy: {
//       equals: user?.id,
//     },
//   };
// };
