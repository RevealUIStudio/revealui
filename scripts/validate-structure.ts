#!/usr/bin/env tsx

/**
 * Validate Codebase Structure After Reorganization
 *
 * This script verifies that the reorganization was successful and
 * that all files are in their correct locations.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface ValidationRule {
	path: string;
	type: "directory" | "file";
	description: string;
	required?: boolean;
}

const VALIDATION_RULES: ValidationRule[] = [
	// Centralized configuration structure
	{
		path: "config",
		type: "directory",
		description: "Centralized configuration root",
		required: true,
	},
	{
		path: "config/build",
		type: "directory",
		description: "Build system configs",
		required: true,
	},
	{
		path: "config/ci",
		type: "directory",
		description: "CI/CD configurations",
		required: true,
	},
	{
		path: "config/ide",
		type: "directory",
		description: "IDE-specific configs",
		required: true,
	},
	{
		path: "config/hooks",
		type: "directory",
		description: "Git hooks",
		required: true,
	},
	{
		path: "config/docs",
		type: "directory",
		description: "Documentation configs",
		required: true,
	},
	{
		path: "config/performance",
		type: "directory",
		description: "Performance configs",
		required: true,
	},
	{
		path: "packages/config/src",
		type: "directory",
		description: "Core project configs",
		required: true,
	},
	{
		path: "config/README.md",
		type: "file",
		description: "Config documentation",
		required: true,
	},

	// Simplified documentation structure
	{
		path: "docs",
		type: "directory",
		description: "Documentation root",
		required: true,
	},
	{
		path: "docs/guides",
		type: "directory",
		description: "User guides",
		required: true,
	},
	{
		path: "docs/reference",
		type: "directory",
		description: "API references",
		required: true,
	},
	{
		path: "docs/development",
		type: "directory",
		description: "Development docs",
		required: true,
	},
	{
		path: "docs/archive",
		type: "directory",
		description: "Historical docs",
		required: true,
	},
	{
		path: "docs/README.md",
		type: "file",
		description: "Docs navigation",
		required: true,
	},

	// Streamlined scripts structure
	{
		path: "scripts",
		type: "directory",
		description: "Scripts root",
		required: true,
	},
	{
		path: "scripts/build",
		type: "directory",
		description: "Build scripts",
		required: true,
	},
	{
		path: "scripts/dev",
		type: "directory",
		description: "Development tools",
		required: true,
	},
	{
		path: "scripts/analysis",
		type: "directory",
		description: "Analysis tools",
		required: true,
	},
	{
		path: "scripts/database",
		type: "directory",
		description: "Database scripts",
		required: true,
	},
	{
		path: "scripts/docs",
		type: "directory",
		description: "Documentation tools",
		required: true,
	},
	{
		path: "scripts/validation",
		type: "directory",
		description: "Quality checks",
		required: true,
	},
	{
		path: "scripts/utils",
		type: "directory",
		description: "Shared utilities",
		required: true,
	},
	{
		path: "scripts/README.md",
		type: "file",
		description: "Scripts documentation",
		required: true,
	},

	// Clean root validation
	{
		path: "README.md",
		type: "file",
		description: "Project README",
		required: true,
	},
	{
		path: "LICENSE",
		type: "file",
		description: "License file",
		required: false,
	},
];

class StructureValidator {
	validate(): boolean {
		console.log("🔍 Validating Reorganized Structure\n");

		let allValid = true;
		const results: Array<{
			rule: ValidationRule;
			valid: boolean;
			message: string;
		}> = [];

		for (const rule of VALIDATION_RULES) {
			const exists = existsSync(rule.path);

			if (rule.required && !exists) {
				results.push({
					rule,
					valid: false,
					message: `❌ MISSING: ${rule.path} - ${rule.description}`,
				});
				allValid = false;
			} else if (exists) {
				// Check if it's the right type
				const stats = statSync(rule.path);
				const isCorrectType =
					(rule.type === "directory" && stats.isDirectory()) ||
					(rule.type === "file" && stats.isFile());

				if (!isCorrectType) {
					results.push({
						rule,
						valid: false,
						message: `❌ WRONG TYPE: ${rule.path} - Expected ${rule.type}, got ${stats.isDirectory() ? "directory" : "file"}`,
					});
					allValid = false;
				} else {
					results.push({
						rule,
						valid: true,
						message: `✅ OK: ${rule.path} - ${rule.description}`,
					});
				}
			} else if (!rule.required) {
				results.push({
					rule,
					valid: true,
					message: `⚠️  OPTIONAL: ${rule.path} - ${rule.description} (not present)`,
				});
			}
		}

		// Print results
		for (const result of results) {
			console.log(result.message);
		}

		// Additional validations
		console.log("\n🔍 Additional Validations:");

		// Check for remaining scattered files
		const rootFiles = readdirSync(".").filter(
			(file) =>
				!file.startsWith(".") &&
				![
					"apps",
					"packages",
					"docs",
					"scripts",
					"config",
					"examples",
					"infrastructure",
					"node_modules",
					"pnpm-lock.yaml",
				].includes(file),
		);

		// Core project files that belong in root
		const coreProjectFiles = [
			"README.md",
			"LICENSE",
			"package.json",
			"pnpm-workspace.yaml",
		];

		const scatteredFiles = rootFiles.filter((file) => {
			const stats = statSync(file);
			return stats.isFile() && !coreProjectFiles.includes(file);
		});

		if (scatteredFiles.length > 0) {
			console.log(`\n⚠️  Remaining scattered files in root:`);
			scatteredFiles.forEach((file) => {
				console.log(`   - ${file}`);
			});
			allValid = false;
		} else {
			console.log("\n✅ No scattered files in root");
		}

		// Check package structure consistency
		console.log("\n🔍 Checking package structure consistency...");
		const packagesDir = "packages";
		if (existsSync(packagesDir)) {
			const packages = readdirSync(packagesDir).filter((item) =>
				statSync(join(packagesDir, item)).isDirectory(),
			);

			for (const pkg of packages) {
				const pkgPath = join(packagesDir, pkg);
				const hasSrc = existsSync(join(pkgPath, "src"));
				const hasTests =
					existsSync(join(pkgPath, "__tests__")) ||
					existsSync(join(pkgPath, "src", "__tests__"));
				const hasPackageJson = existsSync(join(pkgPath, "package.json"));

				if (!hasSrc) {
					console.log(`⚠️  Package ${pkg} missing src/ directory`);
					allValid = false;
				}
				if (!hasTests) {
					console.log(`⚠️  Package ${pkg} missing __tests__ directory`);
				}
				if (!hasPackageJson) {
					console.log(`❌ Package ${pkg} missing package.json`);
					allValid = false;
				}
			}
		}

		console.log(
			`\n${allValid ? "✅" : "❌"} Overall validation: ${allValid ? "PASSED" : "FAILED"}`,
		);

		if (!allValid) {
			console.log("\n💡 Fix issues and re-run validation:");
			console.log("pnpm run validate:structure");
		}

		return allValid;
	}
}

// CLI interface
async function main() {
	console.log("🎯 RevealUI Structure Validation");
	console.log("=".repeat(40));

	const validator = new StructureValidator();
	const success = validator.validate();

	process.exit(success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { StructureValidator, VALIDATION_RULES };
