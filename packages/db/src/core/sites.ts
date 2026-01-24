/**
 * Site tables - Derived from @revealui/contracts SiteSchema
 *
 * These tables store site configurations and collaborator relationships.
 * The schema structure mirrors the Zod schemas in @revealui/contracts/entities.
 */

import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

// =============================================================================
// Sites Table
// =============================================================================

export const sites = pgTable("sites", {
	// Primary identifier
	id: text("id").primaryKey(),

	// Schema versioning for migrations
	schemaVersion: text("schema_version").notNull().default("1"),

	// Ownership
	ownerId: text("owner_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),

	// Basic info
	name: text("name").notNull(),
	slug: text("slug").notNull(),
	description: text("description"),

	// Status: draft, published, archived
	status: text("status").notNull().default("draft"),

	// Theme configuration (JSON blob)
	theme: jsonb("theme"),

	// Site settings (JSON blob)
	settings: jsonb("settings"),

	// Computed metadata
	pageCount: integer("page_count").default(0),

	// SEO
	favicon: text("favicon"),

	// Timestamps
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true }),
});

// =============================================================================
// Site Collaborators Table (Many-to-Many: Sites <-> Users)
// =============================================================================

export const siteCollaborators = pgTable("site_collaborators", {
	// Composite primary key would be (siteId, userId) but Drizzle prefers explicit id
	id: text("id").primaryKey(),

	// Relationships
	siteId: text("site_id")
		.notNull()
		.references(() => sites.id, { onDelete: "cascade" }),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),

	// Role on this site: admin, editor, viewer, contributor
	role: text("role").notNull().default("viewer"),

	// Who added this collaborator
	addedBy: text("added_by").references(() => users.id, {
		onDelete: "set null",
	}),

	// Timestamps
	addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type SiteCollaborator = typeof siteCollaborators.$inferSelect;
export type NewSiteCollaborator = typeof siteCollaborators.$inferInsert;
