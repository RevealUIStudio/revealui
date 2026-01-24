/**
 * Query Builder Utilities
 *
 * Re-exports drizzle-orm query builder functions to ensure all packages
 * use the same drizzle instance, avoiding pnpm hoisting issues.
 *
 * Instead of importing from 'drizzle-orm' directly, import from '@revealui/db/schema/query'
 */

// Re-export types that are commonly used
export type { SQL } from "drizzle-orm";
// Re-export commonly used query builder functions
export {
	and,
	asc,
	avg,
	count,
	desc,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	max,
	min,
	ne,
	not,
	notInArray,
	or,
	sql,
	sum,
} from "drizzle-orm";
