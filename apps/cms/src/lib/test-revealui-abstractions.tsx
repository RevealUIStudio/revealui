// Test file to verify RevealUI framework abstractions work
import {
	createRevealUICollection,
	createRevealUIField,
	type RevealUIAccessArgs,
	type RevealUIAccessResult,
	type RevealUIComponent,
} from "@revealui/core";

// Test that we can create a collection with our abstractions
const testCollection = createRevealUICollection({
	slug: "test",
	fields: [
		createRevealUIField({
			type: "text",
			name: "title",
			label: "Title",
			required: true,
			revealUI: {
				searchable: true,
				permissions: ["read", "update"],
			},
		}),
	],
	revealUI: {
		tenantScoped: true,
		auditLog: true,
	},
});

// Test access control with our abstractions
const testAccess = (_args: RevealUIAccessArgs): RevealUIAccessResult => {
	return true;
};

// Test component with our abstractions
const TestComponent: RevealUIComponent = ({ children, revealUI }) => {
	return <div>{children}</div>;
};

export { testCollection, testAccess, TestComponent };
