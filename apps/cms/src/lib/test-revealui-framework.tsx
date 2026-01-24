// Test file to verify RevealUI framework abstractions actually work
import {
	createRevealUIAccessRule,
	createRevealUIBlock,
	createRevealUICollection,
	createRevealUIField,
	type RevealUIComponent,
} from "@revealui/core";
import { withRevealUIAccess } from "@revealui/core/client";

// Test creating a RevealUI instance
const revealUIConfig = {
	collections: [],
};

// Test creating a collection
const userCollection = createRevealUICollection({
	slug: "users",
	fields: [
		createRevealUIField({
			name: "email",
			type: "email",
			label: "Email Address",
			required: true,
			revealUI: {
				searchable: true,
				permissions: ["read", "admin"],
			},
		}),
		createRevealUIField({
			name: "roles",
			type: "array",
			label: "Roles",
			revealUI: {
				permissions: ["admin"],
			},
		}),
	],
	revealUI: {
		tenantScoped: true,
		auditLog: true,
	},
});

// Test creating a block
const heroBlock = createRevealUIBlock({
	slug: "hero",
	fields: [
		createRevealUIField({
			name: "title",
			type: "text",
			label: "Hero Title",
			required: true,
		}),
		createRevealUIField({
			name: "image",
			type: "upload",
			label: "Hero Image",
		}),
	],
	revealUI: {
		category: "layout",
		permissions: ["read", "update"],
	},
});

// Test creating an access rule
const adminAccessRule = createRevealUIAccessRule({
	permissions: ["admin"],
	condition: (_context) => {
		return true;
	},
});

// Test React component with RevealUI props
const TestComponent: RevealUIComponent = ({ children }) => {
	return <div className="reveal-ui-component">{children}</div>;
};

// Test the wrapped component
const ProtectedComponent = withRevealUIAccess(TestComponent, ["admin"]);

export {
	revealUIConfig,
	userCollection,
	heroBlock,
	adminAccessRule,
	TestComponent,
	ProtectedComponent,
};
