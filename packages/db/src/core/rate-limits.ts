/**
 * Rate Limits and Failed Attempts Tables
 *
 * Tables for storing rate limiting and brute force protection data.
 * Used by the storage abstraction for distributed rate limiting.
 */

import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// =============================================================================
// Rate Limits Table
// =============================================================================

export const rateLimits = pgTable("rate_limits", {
	// Primary key (rate limit key, e.g., email or IP address)
	key: text("key").primaryKey(),

	// Stored value (JSON stringified rate limit entry)
	value: text("value").notNull(),

	// Reset timestamp (when the rate limit window resets)
	resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),

	// Timestamps
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// =============================================================================
// Failed Attempts Table
// =============================================================================

export const failedAttempts = pgTable("failed_attempts", {
	// Primary key (email address)
	email: text("email").primaryKey(),

	// Failed attempt count
	count: integer("count").notNull().default(0),

	// Lock expiration timestamp
	lockUntil: timestamp("lock_until", { withTimezone: true }),

	// Window start timestamp
	windowStart: timestamp("window_start", { withTimezone: true }).notNull(),

	// Timestamps
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// =============================================================================
// Type exports
// =============================================================================

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
export type FailedAttempt = typeof failedAttempts.$inferSelect;
export type NewFailedAttempt = typeof failedAttempts.$inferInsert;
