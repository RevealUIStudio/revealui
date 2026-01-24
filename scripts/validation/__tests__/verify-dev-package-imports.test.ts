/**
 * Tests for verify-dev-package-imports.ts
 * Tests AST-based import validation for dev package imports
 */

import { readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Dev Package Import Verification (AST-based)", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `revealui-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	describe("Good Import Detection", () => {
		it("should detect good dev/... imports", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `import { tailwindConfig } from 'dev/tailwind'
import { postcssConfig } from 'dev/postcss'`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			let hasGood = false;

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					const moduleSpecifier = node.moduleSpecifier;
					if (ts.isStringLiteral(moduleSpecifier)) {
						const source = moduleSpecifier.text;
						if (source.startsWith("dev/")) {
							hasGood = true;
						}
					}
				}
			});

			expect(hasGood).toBe(true);
		});

		it("should detect multiple good imports", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `import { tailwindConfig } from 'dev/tailwind'
import { viteConfig } from 'dev/vite'
import { eslintConfig } from 'dev/eslint'`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			let goodCount = 0;

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					const moduleSpecifier = node.moduleSpecifier;
					if (ts.isStringLiteral(moduleSpecifier)) {
						const source = moduleSpecifier.text;
						if (source.startsWith("dev/")) {
							goodCount++;
						}
					}
				}
			});

			expect(goodCount).toBe(3);
		});
	});

	describe("Bad Import Detection", () => {
		it("should detect relative path to packages/dev/src", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `import { tailwindConfig } from '../../packages/dev/src/tailwind'`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			const issues: string[] = [];

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					const moduleSpecifier = node.moduleSpecifier;
					if (ts.isStringLiteral(moduleSpecifier)) {
						const source = moduleSpecifier.text;
						if (
							source.includes("../packages/dev/src") ||
							source.includes("../../packages/dev/src")
						) {
							issues.push(
								"Uses relative path to packages/dev/src instead of dev/...",
							);
						}
					}
				}
			});

			expect(issues).toHaveLength(1);
		});

		it("should detect relative path to dev/src", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `import { tailwindConfig } from '../dev/src/tailwind'`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			const issues: string[] = [];

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					const moduleSpecifier = node.moduleSpecifier;
					if (ts.isStringLiteral(moduleSpecifier)) {
						const source = moduleSpecifier.text;
						if (
							source.includes("../dev/src") ||
							source.includes("../../dev/src")
						) {
							issues.push("Uses relative path to dev/src instead of dev/...");
						}
					}
				}
			});

			expect(issues).toHaveLength(1);
		});

		it("should detect @revealui/dev imports", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `import { tailwindConfig } from '@revealui/dev/tailwind'`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			const issues: string[] = [];

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					const moduleSpecifier = node.moduleSpecifier;
					if (ts.isStringLiteral(moduleSpecifier)) {
						const source = moduleSpecifier.text;
						if (source.startsWith("@revealui/dev/")) {
							issues.push("Uses @revealui/dev instead of dev");
						}
					}
				}
			});

			expect(issues).toHaveLength(1);
		});
	});

	describe("Line Number Detection", () => {
		it("should detect correct line numbers for bad imports", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `import something from 'other'
import { bad } from '../../packages/dev/src/tailwind'
import { good } from 'dev/tailwind'`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			const badImportLines: number[] = [];

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					const moduleSpecifier = node.moduleSpecifier;
					if (ts.isStringLiteral(moduleSpecifier)) {
						const source = moduleSpecifier.text;
						if (
							source.includes("../packages/dev/src") ||
							source.startsWith("@revealui/dev/")
						) {
							const { line } = sourceFile.getLineAndCharacterOfPosition(
								node.getStart(),
							);
							badImportLines.push(line + 1);
						}
					}
				}
			});

			expect(badImportLines).toHaveLength(1);
			expect(badImportLines[0]).toBe(2);
		});
	});

	describe("Multiple Import Detection", () => {
		it("should handle files with both good and bad imports", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `import { good1 } from 'dev/tailwind'
import { bad } from '../../packages/dev/src/postcss'
import { good2 } from 'dev/vite'`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			let hasGood = false;
			let hasBad = false;

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					const moduleSpecifier = node.moduleSpecifier;
					if (ts.isStringLiteral(moduleSpecifier)) {
						const source = moduleSpecifier.text;
						if (source.startsWith("dev/")) {
							hasGood = true;
						}
						if (
							source.includes("../packages/dev/src") ||
							source.startsWith("@revealui/dev/")
						) {
							hasBad = true;
						}
					}
				}
			});

			expect(hasGood).toBe(true);
			expect(hasBad).toBe(true);
		});
	});

	describe("AST Parsing Accuracy", () => {
		it("should NOT detect imports in strings", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `const message = "import { config } from 'dev/tailwind'"
const other = 'import from @revealui/dev'`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			let importCount = 0;

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					importCount++;
				}
			});

			// AST parser automatically excludes strings
			expect(importCount).toBe(0);
		});

		it("should NOT detect imports in comments", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `// import { config } from 'dev/tailwind'
/* import from @revealui/dev */`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			let importCount = 0;

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isImportDeclaration(node)) {
					importCount++;
				}
			});

			// AST parser automatically excludes comments
			expect(importCount).toBe(0);
		});
	});
});
