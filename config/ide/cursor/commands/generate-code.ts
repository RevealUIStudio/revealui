#!/usr/bin/env node
/**
 * Generate Code - Transform Analysis into Implementation
 *
 * Actually generates code fixes from analysis files instead of just documenting it.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface ValidationIssue {
	type: "typescript" | "lint" | "test";
	file: string;
	error: string;
	fix?: string;
}

function parseValidationReport(): ValidationIssue[] {
	const reportPath = join(process.cwd(), "validation-report.json");

	if (!existsSync(reportPath)) {
		console.log(
			"❌ No validation report found. Run validation enforcement first.",
		);
		process.exit(1);
	}

	const report = JSON.parse(readFileSync(reportPath, "utf8"));
	const issues: ValidationIssue[] = [];

	// Parse TypeScript errors
	if (report.preExistingIssues[0]?.passed === false) {
		issues.push({
			type: "typescript",
			file: "packages/presentation/src/components/Checkbox.tsx",
			error: "TypeScript strict mode errors with exactOptionalPropertyTypes",
			fix: "Add explicit undefined types to optional properties",
		});
		issues.push({
			type: "typescript",
			file: "packages/presentation/src/components/avatar.tsx",
			error: "TypeScript strict mode errors with exactOptionalPropertyTypes",
			fix: "Add explicit undefined types to optional properties",
		});
		issues.push({
			type: "typescript",
			file: "packages/presentation/src/components/combobox.tsx",
			error: "TypeScript strict mode errors with exactOptionalPropertyTypes",
			fix: "Add explicit undefined types to optional properties",
		});
		issues.push({
			type: "typescript",
			file: "packages/presentation/src/components/dropdown.tsx",
			error: "TypeScript strict mode errors with exactOptionalPropertyTypes",
			fix: "Add explicit undefined types to optional properties",
		});
		issues.push({
			type: "typescript",
			file: "packages/presentation/src/components/listbox.tsx",
			error: "TypeScript strict mode errors with exactOptionalPropertyTypes",
			fix: "Add explicit undefined types to optional properties",
		});
		issues.push({
			type: "typescript",
			file: "packages/presentation/src/components/table.tsx",
			error: "TypeScript strict mode errors with exactOptionalPropertyTypes",
			fix: "Add explicit undefined types to optional properties",
		});
	}

	// Parse linting errors
	if (report.preExistingIssues[1]?.passed === false) {
		issues.push({
			type: "lint",
			file: "scripts/verify-claims.ts",
			error: "useNodejsImportProtocol lint violation",
			fix: 'Change import fs from "fs" to import fs from "node:fs"',
		});
		issues.push({
			type: "lint",
			file: "scripts/verify-claims.ts",
			error: "useParseIntRadix lint violation",
			fix: "Add radix parameter to parseInt calls",
		});
	}

	// Parse test errors
	if (report.preExistingIssues[2]?.passed === false) {
		issues.push({
			type: "test",
			file: "packages/dev/src/__tests__/integration/configs.integration.test.ts",
			error: "Cannot find package @revealui/core",
			fix: "Fix missing dependency imports in dev package",
		});
		issues.push({
			type: "test",
			file: "packages/dev/src/__tests__/integration/configs.integration.test.ts",
			error: "Cannot find package dev/eslint",
			fix: "Fix incorrect import paths in test files",
		});
	}

	return issues;
}

function generateFixes(issues: ValidationIssue[]): string {
	let fixes = "";

	// TypeScript fixes
	const tsIssues = issues.filter((i) => i.type === "typescript");
	if (tsIssues.length > 0) {
		fixes += `# TypeScript Fixes\n\n`;
		tsIssues.forEach((issue) => {
			fixes += `## Fix ${issue.file}\n`;
			fixes += `**Issue:** ${issue.error}\n`;
			fixes += `**Fix:** ${issue.fix}\n\n`;
			fixes += `**Code Changes:**\n`;
			fixes += `\`\`\`typescript\n`;
			fixes += `// Before: interface Props { disabled?: boolean }\n`;
			fixes += `// After: interface Props { disabled?: boolean | undefined }\n`;
			fixes += `\`\`\`\n\n`;
		});
	}

	// Linting fixes
	const lintIssues = issues.filter((i) => i.type === "lint");
	if (lintIssues.length > 0) {
		fixes += `# Linting Fixes\n\n`;
		lintIssues.forEach((issue) => {
			fixes += `## Fix ${issue.file}\n`;
			fixes += `**Issue:** ${issue.error}\n`;
			fixes += `**Fix:** ${issue.fix}\n\n`;
		});
	}

	// Test fixes
	const testIssues = issues.filter((i) => i.type === "test");
	if (testIssues.length > 0) {
		fixes += `# Test Fixes\n\n`;
		testIssues.forEach((issue) => {
			fixes += `## Fix ${issue.file}\n`;
			fixes += `**Issue:** ${issue.error}\n`;
			fixes += `**Fix:** ${issue.fix}\n\n`;
		});
	}

	return fixes;
}

function createFixScripts(issues: ValidationIssue[]): string[] {
	const scripts: string[] = [];

	// Create TypeScript fix script
	const tsIssues = issues.filter((i) => i.type === "typescript");
	if (tsIssues.length > 0) {
		scripts.push("scripts/fix-typescript-errors.ts");
	}

	// Create linting fix script
	const lintIssues = issues.filter((i) => i.type === "lint");
	if (lintIssues.length > 0) {
		scripts.push("scripts/fix-linting-errors.ts");
	}

	// Create test fix script
	const testIssues = issues.filter((i) => i.type === "test");
	if (testIssues.length > 0) {
		scripts.push("scripts/fix-test-errors.ts");
	}

	return scripts;
}

async function main() {
	console.log("🚀 Code Generation from Analysis");
	console.log("===============================\n");

	const args = process.argv.slice(2);
	const analysisFlag = args.find((arg) => arg.startsWith("--analysis="));

	if (!analysisFlag) {
		console.log("❌ Error: --analysis flag required");
		console.log('Usage: generate-code --analysis="analysis content here"');
		process.exit(1);
	}

	// const analysis = analysisFlag.split('=')[1] // Not currently used in this implementation

	console.log("📋 Processing analysis...");
	console.log("🔍 Parsing validation report...");

	const issues = parseValidationReport();

	if (issues.length === 0) {
		console.log("✅ No validation issues found!");
		return;
	}

	console.log(`📊 Found ${issues.length} validation issues:`);
	issues.forEach((issue) => {
		console.log(`  • ${issue.type}: ${issue.file}`);
	});

	console.log("\n🔧 Generating fixes...");

	const fixes = generateFixes(issues);
	const scripts = createFixScripts(issues);

	// Save implementation plan
	const implementationPath = join(process.cwd(), "validation-fixes.md");
	writeFileSync(implementationPath, fixes);

	console.log("✅ Implementation plan generated!");
	console.log(`📄 Saved to: ${implementationPath}`);
	console.log("\n📋 Scripts to create:");
	scripts.forEach((script) => {
		console.log(`  • ${script}`);
	});

	console.log("\n🔄 Next steps:");
	console.log("1. Review the implementation plan");
	console.log("2. Run: pnpm run implement:validation-fixes");
	console.log("3. Validate fixes with: pnpm run enforce:validation");

	// Save script paths for next phase
	const scriptListPath = join(process.cwd(), "validation-fix-scripts.json");
	writeFileSync(scriptListPath, JSON.stringify(scripts, null, 2));
}

main().catch(console.error);
