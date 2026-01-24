import type {
	RevealUIAccessContext,
	RevealUIAccessResult,
	RevealUIAccessRule,
	RevealUIPermission,
} from "../types/index.js";

// Create a RevealUI access rule
export function createRevealUIAccessRule(options: {
	tenant?: string;
	user?: string;
	permissions?: RevealUIPermission[];
	condition?: (context: RevealUIAccessContext) => RevealUIAccessResult;
}): RevealUIAccessRule {
	return {
		tenant: options.tenant,
		user: options.user,
		permissions: options.permissions,
		condition: options.condition,
	};
}

// Convert from a simple permission-based rule to RevealUI access rule
export function convertToRevealUIAccessRule(
	permissions: RevealUIPermission[],
): RevealUIAccessRule {
	return createRevealUIAccessRule({
		permissions,
		condition: (context: RevealUIAccessContext) => {
			// Check if user has required permissions
			if (!context.user) return false;

			const userPermissions = context.user.revealUI?.isSuperAdmin
				? ["create", "read", "update", "delete", "publish", "admin"]
				: context.user.roles || [];

			return permissions.every(
				(permission) =>
					userPermissions.includes(permission) ||
					userPermissions.includes("admin"),
			);
		},
	});
}

// Create an enhanced access rule with tenant scoping
export function createEnhancedAccessRule(options: {
	permissions: RevealUIPermission[];
	tenantScoped?: boolean;
	allowSuperAdmin?: boolean;
	customCondition?: (context: RevealUIAccessContext) => RevealUIAccessResult;
}): RevealUIAccessRule {
	return createRevealUIAccessRule({
		permissions: options.permissions,
		condition: (context: RevealUIAccessContext) => {
			// Check super admin override
			if (
				options.allowSuperAdmin !== false &&
				context.user?.revealUI?.isSuperAdmin
			) {
				return true;
			}

			// Check custom condition first
			if (options.customCondition) {
				const customResult = options.customCondition(context);
				if (customResult !== true) {
					return customResult;
				}
			}

			// Check tenant scoping
			if (options.tenantScoped && context.tenant) {
				const userTenants = context.user?.tenants || [];
				if (!userTenants.includes(context.tenant.id)) {
					return false;
				}
			}

			// Check permissions
			if (!context.user) return false;

			const userPermissions = context.user.roles || [];
			return options.permissions.every(
				(permission) =>
					userPermissions.includes(permission) ||
					userPermissions.includes("admin"),
			);
		},
	});
}

// Evaluate an access rule against a context
export function evaluateRevealUIAccessRule(
	rule: RevealUIAccessRule,
	context: RevealUIAccessContext,
): RevealUIAccessResult {
	// Check tenant constraint
	if (rule.tenant && context.tenant?.id !== rule.tenant) {
		return false;
	}

	// Check user constraint
	if (rule.user && context.user?.id !== rule.user) {
		return false;
	}

	// Check permissions
	if (rule.permissions && rule.permissions.length > 0) {
		if (!context.user) return false;

		const userPermissions = context.user.revealUI?.isSuperAdmin
			? ["create", "read", "update", "delete", "publish", "admin"]
			: context.user.roles || [];

		const hasPermission = rule.permissions.every(
			(permission) =>
				userPermissions.includes(permission) ||
				userPermissions.includes("admin"),
		);

		if (!hasPermission) {
			return false;
		}
	}

	// Check custom condition
	if (rule.condition) {
		return rule.condition(context);
	}

	return true;
}

// Combine multiple access rules with OR logic
export function combineRevealUIAccessRules(
	rules: RevealUIAccessRule[],
	operator: "AND" | "OR" = "OR",
): RevealUIAccessRule {
	return createRevealUIAccessRule({
		condition: (context: RevealUIAccessContext) => {
			if (operator === "OR") {
				return rules.some(
					(rule) => evaluateRevealUIAccessRule(rule, context) === true,
				);
			} else {
				return rules.every(
					(rule) => evaluateRevealUIAccessRule(rule, context) === true,
				);
			}
		},
	});
}
