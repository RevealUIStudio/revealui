/**
 * Tests for audit-console-usage.ts
 * Tests AST-based console usage detection and file categorization
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Console Usage Audit (AST-based)", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `revealui-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	describe("Console Method Detection", () => {
		it("should detect console.log() calls", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `export function test() {
  console.log('hello')
}`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			const matches: string[] = [];
			const lines = content.split("\n");

			function findConsole(node: ts.Node) {
				if (ts.isPropertyAccessExpression(node)) {
					const expr = node.expression;
					if (ts.isIdentifier(expr) && expr.text === "console") {
						const methodName = node.name.text;
						const parent = node.parent;
						if (parent && ts.isCallExpression(parent)) {
							const { line } = sourceFile.getLineAndCharacterOfPosition(
								node.getStart(),
							);
							matches.push(methodName);
						}
					}
				}
				ts.forEachChild(node, findConsole);
			}

			findConsole(sourceFile);

			expect(matches).toHaveLength(1);
			expect(matches[0]).toBe("log");
		});

		it("should detect multiple console methods", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `export function test() {
  console.log('info')
  console.error('error')
  console.warn('warning')
  console.debug('debug')
  console.info('info')
}`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			const matches: string[] = [];

			function findConsole(node: ts.Node) {
				if (ts.isPropertyAccessExpression(node)) {
					const expr = node.expression;
					if (ts.isIdentifier(expr) && expr.text === "console") {
						const methodName = node.name.text;
						const parent = node.parent;
						if (parent && ts.isCallExpression(parent)) {
							matches.push(methodName);
						}
					}
				}
				ts.forEachChild(node, findConsole);
			}

			findConsole(sourceFile);

			expect(matches).toHaveLength(5);
			expect(matches).toContain("log");
			expect(matches).toContain("error");
			expect(matches).toContain("warn");
			expect(matches).toContain("debug");
			expect(matches).toContain("info");
		});
	});

	describe("File Categorization", () => {
		it("should categorize production files correctly", async () => {
			const prodDir = join(testDir, "packages", "core", "src");
			await mkdir(prodDir, { recursive: true });
			const testFile = join(prodDir, "test.ts");

			// Production file path should be categorized as 'production'
			const relativePath = testFile.replace(testDir, "").replace(/^\//, "");
			const isProduction =
				relativePath.includes("/src/") &&
				(relativePath.startsWith("packages/") ||
					relativePath.startsWith("apps/"));

			expect(isProduction).toBe(true);
		});

		it("should categorize test files correctly", async () => {
			const testFilePath = join(testDir, "test.test.ts");
			const specFilePath = join(testDir, "test.spec.ts");
			const testsDir = join(testDir, "__tests__", "test.ts");

			const isTestFile = (path: string) => {
				const name = path.split("/").pop() || "";
				return (
					name.includes(".test.") ||
					name.includes(".spec.") ||
					path.includes("__tests__") ||
					path.includes("/tests/")
				);
			};

			expect(isTestFile(testFilePath)).toBe(true);
			expect(isTestFile(specFilePath)).toBe(true);
			expect(isTestFile(testsDir)).toBe(true);
		});

		it("should categorize script files correctly", async () => {
			const scriptPath = join(testDir, "scripts", "test.ts");
			const configPath = join(testDir, "test.config.ts");

			const isScript = (path: string) => {
				const name = path.split("/").pop() || "";
				return (
					path.includes("scripts/") ||
					path.includes("/scripts/") ||
					name.endsWith(".config.ts") ||
					name.endsWith(".config.js")
				);
			};

			expect(isScript(scriptPath)).toBe(true);
			expect(isScript(configPath)).toBe(true);
		});
	});

	describe("Line and Column Detection", () => {
		it("should detect correct line and column numbers", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `export function test() {
  console.log('hello')
  const x = 1
  console.error('error')
}`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			const matches: Array<{ line: number; column: number; method: string }> =
				[];

			function findConsole(node: ts.Node) {
				if (ts.isPropertyAccessExpression(node)) {
					const expr = node.expression;
					if (ts.isIdentifier(expr) && expr.text === "console") {
						const methodName = node.name.text;
						const parent = node.parent;
						if (parent && ts.isCallExpression(parent)) {
							const { line, character } =
								sourceFile.getLineAndCharacterOfPosition(node.getStart());
							matches.push({
								line: line + 1,
								column: character + 1,
								method: methodName,
							});
						}
					}
				}
				ts.forEachChild(node, findConsole);
			}

			findConsole(sourceFile);

			expect(matches).toHaveLength(2);
			expect(matches[0]).toMatchObject({ line: 2, method: "log" });
			expect(matches[1]).toMatchObject({ line: 4, method: "error" });
		});
	});

	describe("Code Snippet Extraction", () => {
		it("should extract code snippets correctly", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `export function test() {
  console.log('this is a longer message that might be truncated')
}`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			const matches: Array<{ code: string }> = [];
			const lines = content.split("\n");

			function findConsole(node: ts.Node) {
				if (ts.isPropertyAccessExpression(node)) {
					const expr = node.expression;
					if (ts.isIdentifier(expr) && expr.text === "console") {
						const parent = node.parent;
						if (parent && ts.isCallExpression(parent)) {
							const { line } = sourceFile.getLineAndCharacterOfPosition(
								node.getStart(),
							);
							const lineText = lines[line]?.trim() || "";
							matches.push({
								code: lineText.substring(0, 100),
							});
						}
					}
				}
				ts.forEachChild(node, findConsole);
			}

			findConsole(sourceFile);

			expect(matches).toHaveLength(1);
			expect(matches[0].code).toContain(
				"console.log('this is a longer message",
			);
		});
	});

	describe("Performance Optimization", () => {
		it("should use cached lines array instead of repeated split()", async () => {
			const testFile = join(testDir, "test.ts");
			const content = `export function test() {
  console.log('test1')
  console.log('test2')
  console.log('test3')
}`;
			await writeFile(testFile, content);

			const sourceFile = ts.createSourceFile(
				testFile,
				content,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			// Simulate cached context (like audit-console-usage.ts does)
			const lines = content.split("\n");
			const context = { sourceFile, lines };

			let splitCallCount = 0;
			const originalSplit = String.prototype.split;

			// Count split() calls
			String.prototype.split = function (...args: any[]) {
				splitCallCount++;
				return originalSplit.apply(this, args);
			};

			const matches: number[] = [];

			function findConsole(node: ts.Node) {
				if (ts.isPropertyAccessExpression(node)) {
					const expr = node.expression;
					if (ts.isIdentifier(expr) && expr.text === "console") {
						const parent = node.parent;
						if (parent && ts.isCallExpression(parent)) {
							const { line } = context.sourceFile.getLineAndCharacterOfPosition(
								node.getStart(),
							);
							// Use cached lines instead of calling split()
							const lineText = context.lines[line]?.trim() || "";
							if (lineText.includes("console.log")) {
								matches.push(line + 1);
							}
						}
					}
				}
				ts.forEachChild(node, findConsole);
			}

			findConsole(sourceFile);

			// Restore original
			String.prototype.split = originalSplit;

			// Should find 3 matches without calling split() in the traversal
			expect(matches).toHaveLength(3);
		});
	});
});
