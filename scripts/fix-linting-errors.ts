#!/usr/bin/env node
/**
 * Fix Linting Errors Script
 *
 * Automatically fixes linting violations in our scripts
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function fixLintingErrors(content: string): string {
	let fixedContent = content;

	// Fix useNodejsImportProtocol: import fs from 'fs' → import fs from 'node:fs'
	fixedContent = fixedContent.replace(
		/import\s+fs\s+from\s+['"]fs['"]/g,
		"import fs from 'node:fs'",
	);

	// Fix useParseIntRadix: Add radix parameter to parseInt calls
	fixedContent = fixedContent.replace(
		/parseInt\(([^,)]+)\)/g,
		"parseInt($1, 10)",
	);

	return fixedContent;
}

function fixFile(filepath: string) {
	if (!existsSync(filepath)) {
		console.log(`⚠️  File not found: ${filepath}`);
		return false;
	}

	console.log(`🔧 Fixing linting in: ${filepath}`);

	const content = readFileSync(filepath, "utf8");
	const fixedContent = fixLintingErrors(content);

	if (content !== fixedContent) {
		writeFileSync(filepath, fixedContent);
		console.log(`✅ Fixed linting in: ${filepath}`);
		return true;
	} else {
		console.log(`ℹ️  No linting fixes needed: ${filepath}`);
		return false;
	}
}

async function main() {
	console.log("🔧 Linting Error Fixer");
	console.log("======================\n");

	const filesToFix = [
		"scripts/verify-claims.ts",
		"scripts/audit-docs.ts",
		"scripts/consolidate-docs.ts",
		"scripts/enforce-validation.ts",
		"scripts/setup-cursor-commands.ts",
		"scripts/fix-typescript-errors.ts",
	];

	let totalFixed = 0;

	for (const filename of filesToFix) {
		const filepath = join(process.cwd(), filename);
		if (fixFile(filepath)) {
			totalFixed++;
		}
	}

	console.log(`\n✅ Fixed linting in ${totalFixed} files`);

	if (totalFixed > 0) {
		console.log("\n🔍 Run linting validation to check fixes");
	}
}

main().catch(console.error);
