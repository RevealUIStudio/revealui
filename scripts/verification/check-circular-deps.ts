#!/usr/bin/env tsx
/**
 * Circular Dependency Checker
 *
 * Checks for circular dependencies in the file splitting refactoring.
 * This is a simple manual check - for production use, consider using dpdm or madge.
 *
 * Usage:
 *   pnpm tsx scripts/verification/check-circular-deps.ts
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, getProjectRoot } from "../shared/utils.js";

const logger = createLogger();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, "../..");
const PACKAGES_REVEALUI = join(ROOT, "packages/core/src");

interface ImportInfo {
	file: string;
	imports: string[];
}

function extractImports(filePath: string): string[] {
	try {
		const content = readFileSync(filePath, "utf-8");
		const imports: string[] = [];

		// Match import statements
		const importRegex = /import\s+(?:[\w*{}\s,]*\s+from\s+)?['"]([^'"]+)['"]/g;
		let match;

		while ((match = importRegex.exec(content)) !== null) {
			const importPath = match[1];
			// Only track relative imports (not node_modules or absolute)
			if (importPath.startsWith(".") || importPath.startsWith("../../")) {
				imports.push(importPath);
			}
		}

		return imports;
	} catch (error) {
		logger.error(
			`Error reading ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
}

function _resolveImport(_fromFile: string, _importPath: string): string | null {
	// Simplified resolution - in practice, this would need proper module resolution
	// For now, just check if the file exists
	return null;
}

async function checkCircularDeps() {
	try {
		await getProjectRoot(import.meta.url);
		logger.header("Circular Dependency Check");

		const filesToCheck = [
			join(PACKAGES_REVEALUI, "collections/CollectionOperations.ts"),
			join(PACKAGES_REVEALUI, "collections/operations/find.ts"),
			join(PACKAGES_REVEALUI, "collections/operations/findById.ts"),
			join(PACKAGES_REVEALUI, "collections/operations/create.ts"),
			join(PACKAGES_REVEALUI, "collections/operations/update.ts"),
			join(PACKAGES_REVEALUI, "collections/operations/delete.ts"),
			join(PACKAGES_REVEALUI, "instance/RevealUIInstance.ts"),
			join(PACKAGES_REVEALUI, "instance/methods/find.ts"),
			join(PACKAGES_REVEALUI, "instance/methods/findById.ts"),
			join(PACKAGES_REVEALUI, "instance/methods/create.ts"),
			join(PACKAGES_REVEALUI, "instance/methods/update.ts"),
			join(PACKAGES_REVEALUI, "instance/methods/delete.ts"),
		];

		logger.info("Checking for circular dependencies...\n");

		const fileInfo: ImportInfo[] = filesToCheck
			.filter((f) => {
				try {
					return readFileSync(f, "utf-8");
				} catch {
					return false;
				}
			})
			.map((file) => ({
				file,
				imports: extractImports(file),
			}));

		// Check for cycles (simplified - just check direct imports)
		let cyclesFound = false;

		for (const info of fileInfo) {
			const fileName = info.file.split("/").pop() || "";
			logger.info(`📄 ${fileName}`);
			logger.info(`   Imports: ${info.imports.length} relative imports`);

			// Check if this file imports CollectionOperations or RevealUIInstance
			const importsOperations = info.imports.some(
				(imp) =>
					imp.includes("CollectionOperations") ||
					imp.includes("RevealUIInstance"),
			);

			if (
				importsOperations &&
				(fileName.includes("operations") || fileName.includes("methods"))
			) {
				logger.warning(`   WARNING: ${fileName} imports parent class/file`);
				cyclesFound = true;
			}
		}

		logger.info("\n");

		if (!cyclesFound) {
			logger.success("No obvious circular dependencies detected");
			logger.info(
				"   (This is a simplified check - use dpdm or madge for thorough analysis)",
			);
		} else {
			logger.error("Potential circular dependencies detected");
			process.exit(1);
		}
	} catch (error) {
		logger.error(
			`Script failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		if (error instanceof Error && error.stack) {
			logger.error(`Stack trace: ${error.stack}`);
		}
		process.exit(1);
	}
}

/**
 * Main function
 */
async function main() {
	try {
		await checkCircularDeps();
	} catch (error) {
		logger.error(
			`Script failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

main();
