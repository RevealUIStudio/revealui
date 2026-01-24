import type { FieldAccess, FieldAccessArgs } from "@revealui/core";
import type { User } from "@revealui/core/types/cms";
import { isSuperAdmin } from "./isSuperAdmin";

// Type for user with tenant relationships
interface UserWithTenants extends User {
	tenants?: Array<{
		tenant: number | unknown;
		roles: string[];
		id?: string | null;
	}> | null;
}

export const isUserOrTenant: FieldAccess = async (args: FieldAccessArgs) => {
	const { req } = args;
	const user = req?.user;
	const revealui = req?.revealui;

	// Bail if no RevealUI CMS instance
	if (!revealui) {
		return false;
	}

	// Allow super admins through
	if (await isSuperAdmin(args)) {
		return true;
	}

	const host = req.headers?.get?.("host") || "";

	const foundTenants = await revealui.find({
		collection: "tenants",
		where: { "domains.domain": { equals: host } },
		depth: 0,
		limit: 1,
		req,
	});

	if (foundTenants.totalDocs === 0) {
		return false;
	}

	// Check if the user is associated with the found tenant
	const userWithTenants = user as UserWithTenants | undefined;
	const tenantWithUser = userWithTenants?.tenants?.find(
		({ tenant: userTenant }) => userTenant === foundTenants.docs[0].id,
	);

	// If user exists, grant access (they're a logged-in user)
	// OR if tenant relationship exists, grant access (they're associated with this tenant)
	return user !== undefined || tenantWithUser !== undefined;
};
