#!/usr/bin/env tsx

/**
 * Clean Remaining Root Files
 *
 * This script organizes the remaining scattered files in the root directory
 * into appropriate locations according to the new structure.
 */

import {
	readdirSync,
	statSync,
	renameSync,
	mkdirSync,
	existsSync,
	rmSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";

interface FileMove {
	from: string;
	to: string;
	description: string;
	category: "documentation" | "config" | "development" | "tools" | "obsolete";
}

// Define the cleanup plan based on file analysis
const CLEANUP_PLAN: FileMove[] = [
	// Documentation files → docs/
	{
		from: "CHANGELOG.md",
		to: "docs/reference/CHANGELOG.md",
		description: "Move changelog to reference docs",
		category: "documentation",
	},
	{
		from: "CONTRIBUTING.md",
		to: "docs/guides/CONTRIBUTING.md",
		description: "Move contributing guide to guides",
		category: "documentation",
	},
	{
		from: "REVEALUI_FEATURES.md",
		to: "docs/reference/FEATURES.md",
		description: "Move features to reference docs",
		category: "documentation",
	},
	{
		from: "SECURITY.md",
		to: "docs/guides/SECURITY.md",
		description: "Move security guide to guides",
		category: "documentation",
	},

	// Development docs → docs/development/
	{
		from: "CLEANUP_BACKLOG.md",
		to: "docs/development/CLEANUP_BACKLOG.md",
		description: "Move cleanup backlog to development docs",
		category: "development",
	},
	{
		from: "DEVELOPMENT_SAFEGUARDS.md",
		to: "docs/development/SAFEGUARDS.md",
		description: "Move safeguards to development docs",
		category: "development",
	},
	{
		from: "MIGRATION_GUIDE.md",
		to: "docs/guides/MIGRATION_GUIDE.md",
		description: "Move migration guide to guides",
		category: "development",
	},
	{
		from: "test-infrastructure-validation.md",
		to: "docs/development/test-infrastructure-validation.md",
		description: "Move test validation to development docs",
		category: "development",
	},
	{
		from: "validation-fixes.md",
		to: "docs/development/validation-fixes.md",
		description: "Move validation fixes to development docs",
		category: "development",
	},

	// Legal docs → docs/guides/ or create docs/legal/
	{
		from: "CODE_OF_CONDUCT.md",
		to: "docs/guides/CODE_OF_CONDUCT.md",
		description: "Move code of conduct to guides",
		category: "documentation",
	},

	// Config files → config/
	{
		from: "biome.json",
		to: "packages/config/src/biome.json",
		description: "Move biome config to project config",
		category: "config",
	},
	{
		from: "env.d.ts",
		to: "packages/config/src/env.d.ts",
		description: "Move env types to project config",
		category: "config",
	},
	{
		from: "renovate.json5",
		to: "config/ci/renovate.json5",
		description: "Move renovate config to CI config",
		category: "config",
	},
	{
		from: "vercel.json",
		to: "config/ci/vercel.json",
		description: "Move vercel config to CI config",
		category: "config",
	},
	{
		from: "openapi.json",
		to: "docs/reference/openapi.json",
		description: "Move OpenAPI spec to reference docs",
		category: "config",
	},

	// Tools/utilities → scripts/
	{
		from: "debug-utils.mjs",
		to: "scripts/utils/debug-utils.mjs",
		description: "Move debug utils to scripts",
		category: "tools",
	},
];

class RootFileCleaner {
	private dryRun: boolean = true;

	constructor(dryRun: boolean = true) {
		this.dryRun = dryRun;
	}

	async clean(): Promise<void> {
		console.log("🧹 Cleaning Remaining Root Files\n");

		// Analyze current root files
		await this.analyzeRootFiles();

		// Create necessary directories
		await this.createDirectories();

		// Move files according to plan
		await this.moveFiles();

		// Update package.json if needed
		await this.updatePackageJson();

		console.log("\n✅ Root file cleanup completed!");
		console.log("\n📋 Next Steps:");
		console.log("1. Review moved files for correctness");
		console.log("2. Update any broken references");
		console.log(
			"3. Run validation: pnpm typecheck:all && pnpm lint && pnpm test",
		);
	}

	private async analyzeRootFiles(): Promise<void> {
		console.log("📊 Analyzing current root files...");

		const rootFiles = readdirSync(".").filter((file) => {
			const stats = statSync(file);
			return stats.isFile() && !file.startsWith(".");
		});

		console.log(`Found ${rootFiles.length} files in root directory:`);

		// Categorize files
		const categories = {
			documentation: [] as string[],
			config: [] as string[],
			development: [] as string[],
			tools: [] as string[],
			core: [] as string[],
			other: [] as string[],
		};

		for (const file of rootFiles) {
			if (
				[
					"README.md",
					"LICENSE",
					"package.json",
					"pnpm-lock.yaml",
					"pnpm-workspace.yaml",
				].includes(file)
			) {
				categories.core.push(file);
			} else if (
				file.endsWith(".md") &&
				[
					"CHANGELOG",
					"CONTRIBUTING",
					"SECURITY",
					"CODE_OF_CONDUCT",
					"REVEALUI_FEATURES",
				].some((prefix) => file.startsWith(prefix))
			) {
				categories.documentation.push(file);
			} else if (
				[
					"biome.json",
					"env.d.ts",
					"renovate.json5",
					"vercel.json",
					"openapi.json",
				].includes(file)
			) {
				categories.config.push(file);
			} else if (
				file.includes("DEVELOPMENT") ||
				file.includes("CLEANUP") ||
				file.includes("validation") ||
				file.includes("test-infrastructure")
			) {
				categories.development.push(file);
			} else if (file.endsWith(".mjs") || file.includes("debug")) {
				categories.tools.push(file);
			} else {
				categories.other.push(file);
			}
		}

		Object.entries(categories).forEach(([category, files]) => {
			if (files.length > 0) {
				console.log(`  ${category}: ${files.length} files`);
				files.forEach((file) => console.log(`    - ${file}`));
			}
		});
	}

	private async createDirectories(): Promise<void> {
		console.log("\n📁 Creating additional directories...");

		const directories = ["docs/legal", "scripts/utils"];

		for (const dir of directories) {
			if (!existsSync(dir)) {
				if (!this.dryRun) {
					mkdirSync(dir, { recursive: true });
				}
				console.log(`  ${this.dryRun ? "[DRY RUN] " : ""}Created: ${dir}/`);
			}
		}
	}

	private async moveFiles(): Promise<void> {
		console.log("\n📦 Moving files to appropriate locations...");

		for (const move of CLEANUP_PLAN) {
			if (existsSync(move.from)) {
				if (!this.dryRun) {
					// Ensure destination directory exists
					const destDir = dirname(move.to);
					mkdirSync(destDir, { recursive: true });

					// Move the file
					renameSync(move.from, move.to);
				}
				console.log(
					`  ${this.dryRun ? "[DRY RUN] " : ""}Moved: ${move.from} → ${move.to}`,
				);
				console.log(`    ${move.description}`);
			} else {
				console.log(`  ⚠️  Source not found: ${move.from}`);
			}
		}
	}

	private async updatePackageJson(): Promise<void> {
		console.log("\n📝 Updating package.json references...");

		const packageJsonPath = "package.json";
		if (existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

			// Update any references to moved files if they exist
			// For example, if there are scripts referencing biome.json, update them

			if (!this.dryRun) {
				// Add any new scripts if needed
				const scripts = packageJson.scripts || {};
				scripts["clean:root"] = "pnpm dlx tsx scripts/clean-root-files.ts";
				scripts["clean:root:apply"] =
					"pnpm dlx tsx scripts/clean-root-files.ts --apply";

				writeFileSync(
					packageJsonPath,
					JSON.stringify(packageJson, null, 2) + "\n",
				);
				console.log("  Updated package.json with cleanup scripts");
			} else {
				console.log(
					"  [DRY RUN] Would update package.json with cleanup scripts",
				);
			}
		}
	}

	async validate(): Promise<void> {
		console.log("\n🔍 Validating cleanup...");

		// Check that core files remain
		const coreFiles = [
			"README.md",
			"LICENSE",
			"package.json",
			"pnpm-lock.yaml",
			"pnpm-workspace.yaml",
		];
		for (const file of coreFiles) {
			if (existsSync(file)) {
				console.log(`  ✅ Core file present: ${file}`);
			} else {
				console.log(`  ❌ Missing core file: ${file}`);
			}
		}

		// Check that moved files are in new locations
		let movedCount = 0;
		for (const move of CLEANUP_PLAN) {
			if (existsSync(move.to) && !existsSync(move.from)) {
				console.log(`  ✅ Successfully moved: ${move.from} → ${move.to}`);
				movedCount++;
			} else if (existsSync(move.from)) {
				console.log(`  ❌ Still present in root: ${move.from}`);
			}
		}

		console.log(
			`\n📊 Cleanup Summary: ${movedCount}/${CLEANUP_PLAN.length} files moved successfully`,
		);

		// Count remaining root files
		const remainingFiles = readdirSync(".")
			.filter((file) => {
				const stats = statSync(file);
				return stats.isFile() && !file.startsWith(".");
			})
			.filter(
				(file) =>
					![
						"README.md",
						"LICENSE",
						"package.json",
						"pnpm-lock.yaml",
						"pnpm-workspace.yaml",
					].includes(file),
			);

		console.log(`📁 Remaining files in root: ${remainingFiles.length}`);
		if (remainingFiles.length > 0) {
			remainingFiles.forEach((file) => console.log(`  - ${file}`));
		}
	}
}

// CLI interface
async function main() {
	const args = process.argv.slice(2);
	const dryRun = !args.includes("--apply");

	console.log("🧹 Root File Cleanup");
	console.log("=".repeat(30));

	if (dryRun) {
		console.log("🚨 DRY RUN MODE - No changes will be made");
		console.log("Run with --apply to execute the cleanup");
	} else {
		console.log("⚠️  LIVE MODE - Files will be moved");
		console.log("Make sure you have committed all current changes first!");
	}

	console.log("");

	const cleaner = new RootFileCleaner(dryRun);

	try {
		await cleaner.clean();
		await cleaner.validate();

		if (dryRun) {
			console.log("\n💡 To apply these changes, run:");
			console.log("pnpm run clean:root:apply");
		}
	} catch (error) {
		console.error("\n❌ Cleanup failed:", error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { RootFileCleaner, CLEANUP_PLAN };
