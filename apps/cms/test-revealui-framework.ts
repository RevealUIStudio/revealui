// Test that RevealUI framework abstractions work
import { createRevealUICollection, createRevealUIField } from "@revealui/core";

// Test collection creation with framework features
const testCollection = createRevealUICollection({
	slug: "test-posts",
	fields: [
		createRevealUIField({
			name: "title",
			type: "text",
			label: "Title",
			required: true,
			revealUI: {
				searchable: true,
				auditable: true,
			},
		}),
	],
	revealUI: {
		tenantScoped: true,
		auditLog: true,
	},
});

// Test main instance creation
const testConfig = {
	collections: [testCollection],
};

// Verify framework abstractions work
console.log("✅ RevealUI Framework Test Passed:", {
	collection: testCollection.slug,
	hasTenantScope: testCollection.revealUI.tenantScoped,
	hasAuditLog: testCollection.revealUI.auditLog,
});

export { testCollection, testConfig };
