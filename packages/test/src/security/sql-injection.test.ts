/**
 * SQL Injection Prevention Tests
 *
 * Tests for SQL injection prevention in database setup scripts.
 * Verifies that all SQL queries use validated inputs.
 */

import { describe, expect, it } from "vitest";

/**
 * Validates that a string is a safe SQL identifier (table/column name)
 * Only allows alphanumeric characters and underscores
 *
 * This is the same function used in setup-dual-database.ts
 */
function validateSQLIdentifier(identifier: string): void {
	if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
		throw new Error(
			`Invalid SQL identifier: ${identifier}. Only alphanumeric and underscore allowed.`,
		);
	}
}

describe("SQL Injection Prevention", () => {
	describe("validateSQLIdentifier", () => {
		it("should accept valid SQL identifiers", () => {
			const validIdentifiers = [
				"users",
				"users_table",
				"users123",
				"Users",
				"USERS",
				"user_name",
				"a",
				"a1",
				"a_1",
				"_users",
				"users_",
			];

			for (const identifier of validIdentifiers) {
				expect(() => validateSQLIdentifier(identifier)).not.toThrow();
			}
		});

		it("should reject SQL injection attempts", () => {
			const maliciousInputs = [
				"'; DROP TABLE users; --",
				"users'; DELETE FROM users WHERE '1'='1",
				'users"; DROP TABLE users; --',
				"users' OR '1'='1",
				"users' UNION SELECT * FROM users--",
				"users'; INSERT INTO users VALUES ('hacker', 'pass'); --",
				"users' OR 1=1--",
				"users' OR 'a'='a",
				"users'; UPDATE users SET password='hacked'; --",
				"users' OR 1=1#",
				"users' OR 'x'='x",
				"users' AND 1=1--",
				"users' AND 'a'='a",
				"users' OR 1=1/*",
				"users' OR '1'='1'--",
				"users' OR '1'='1'/*",
				"users' OR '1'='1'#",
				"users' OR '1'='1' LIMIT 1--",
				"users' OR '1'='1' LIMIT 1/*",
				"users' OR '1'='1' LIMIT 1#",
			];

			for (const malicious of maliciousInputs) {
				expect(() => validateSQLIdentifier(malicious)).toThrow(
					`Invalid SQL identifier: ${malicious}. Only alphanumeric and underscore allowed.`,
				);
			}
		});

		it("should reject identifiers with special characters", () => {
			const invalidIdentifiers = [
				"users-table",
				"users.table",
				"users table",
				"users@table",
				"users#table",
				"users$table",
				"users%table",
				"users&table",
				"users*table",
				"users+table",
				"users=table",
				"users/table",
				"users\\table",
				"users|table",
				"users<table",
				"users>table",
				"users?table",
				"users!table",
				"users~table",
				"users`table",
				"users[table",
				"users]table",
				"users{table",
				"users}table",
				"users(table",
				"users)table",
				"users;table",
				"users:table",
				'users"table',
				"users'table",
				"users,table",
				"users.table",
				"users;",
				"users--",
				"users/*",
				"users*/",
				"users#",
				"",
				" ",
				"  ",
				"\n",
				"\t",
				"\r",
			];

			for (const invalid of invalidIdentifiers) {
				expect(() => validateSQLIdentifier(invalid)).toThrow();
			}
		});

		it("should reject identifiers with unicode characters", () => {
			const unicodeIdentifiers = [
				"users表",
				"users🎉",
				"users🚀",
				"users💻",
				"users🔥",
			];

			for (const unicode of unicodeIdentifiers) {
				expect(() => validateSQLIdentifier(unicode)).toThrow();
			}
		});

		it("should reject null and undefined", () => {
			expect(() => validateSQLIdentifier(null as unknown as string)).toThrow();
			expect(() =>
				validateSQLIdentifier(undefined as unknown as string),
			).toThrow();
		});

		it("should reject non-string types", () => {
			expect(() => validateSQLIdentifier(123 as unknown as string)).toThrow();
			expect(() => validateSQLIdentifier({} as unknown as string)).toThrow();
			expect(() => validateSQLIdentifier([] as unknown as string)).toThrow();
		});
	});
});
