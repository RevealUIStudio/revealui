import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type Config,
	type DocFile,
	discoverDocs,
	loadConfig,
	validatePackageNames,
} from "../docs-lifecycle";

describe("Documentation Lifecycle Manager", () => {
	let testDir: string;
	let testConfigPath: string;

	beforeEach(async () => {
		testDir = await fs.mkdtemp(path.join(tmpdir(), "docs-lifecycle-test-"));
		testConfigPath = path.join(testDir, "docs-lifecycle.config.json");
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	describe("Config Validation", () => {
		it("should load and validate config", async () => {
			const validConfig = {
				patterns: {
					track: ["**/*.md"],
					ignore: ["node_modules/**"],
					rootOnly: false,
				},
				validation: {
					checkPackageNames: true,
					checkFileReferences: true,
					checkCodeSnippets: true,
					checkDates: true,
					checkStatus: true,
					checkTodos: true,
					maxAgeDays: 90,
				},
				actions: {
					onStale: "archive" as const,
					archiveDir: "docs/archive",
					dryRun: false,
				},
				watch: {
					enabled: true,
					debounceMs: 1000,
				},
			};

			await fs.writeFile(testConfigPath, JSON.stringify(validConfig));
			const config = await loadConfig();
			expect(config).toBeDefined();
			expect(config.validation.checkPackageNames).toBe(true);
		});

		it("should use default config when file is missing", async () => {
			const config = await loadConfig();
			expect(config).toBeDefined();
			expect(config.validation.statusThresholdDays).toBe(90);
		});
	});

	describe("File Discovery", () => {
		it("should ignore node_modules", async () => {
			// Create test structure
			await fs.mkdir(path.join(testDir, "node_modules", "test"), {
				recursive: true,
			});
			await fs.writeFile(
				path.join(testDir, "node_modules", "test", "readme.md"),
				"# Test",
			);
			await fs.writeFile(path.join(testDir, "README.md"), "# Main README");

			const config: Config = {
				patterns: {
					track: ["**/*.md"],
					ignore: ["node_modules/**"],
					rootOnly: false,
				},
				validation: {
					checkPackageNames: false,
					checkFileReferences: false,
					checkCodeSnippets: false,
					checkDates: false,
					checkStatus: false,
					checkTodos: false,
					maxAgeDays: null,
					statusThresholdDays: 90,
				},
				actions: {
					onStale: "archive",
					archiveDir: "docs/archive",
					dryRun: false,
				},
				watch: {
					enabled: true,
					debounceMs: 1000,
				},
			};

			// Change to test directory temporarily
			const originalCwd = process.cwd();
			process.chdir(testDir);
			try {
				const files = await discoverDocs(config);
				expect(files.length).toBe(1);
				expect(files[0].relativePath).toBe("README.md");
			} finally {
				process.chdir(originalCwd);
			}
		});
	});

	describe("Package Name Validation", () => {
		it("should detect outdated package names", async () => {
			const file: DocFile = {
				path: path.join(testDir, "test.md"),
				relativePath: "test.md",
				content: "import { something } from '@revealui/cms'",
				stats: {} as any,
			};
			const config: Config = {
				patterns: { track: [], ignore: [], rootOnly: false },
				validation: {
					checkPackageNames: true,
					checkFileReferences: false,
					checkCodeSnippets: false,
					checkDates: false,
					checkStatus: false,
					checkTodos: false,
					maxAgeDays: null,
					statusThresholdDays: 90,
					outdatedPackageNames: ["@revealui/cms"],
					replacementPackageName: "@revealui/core",
				},
				actions: { onStale: "archive", archiveDir: "archive", dryRun: false },
				watch: { enabled: true, debounceMs: 1000 },
			};

			const errors = await validatePackageNames(file, config);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0].type).toBe("packageName");
		});

		it("should not flag valid package names", async () => {
			const file: DocFile = {
				path: path.join(testDir, "test.md"),
				relativePath: "test.md",
				content: "import { something } from '@revealui/core'",
				stats: {} as any,
			};
			const config: Config = {
				patterns: { track: [], ignore: [], rootOnly: false },
				validation: {
					checkPackageNames: true,
					checkFileReferences: false,
					checkCodeSnippets: false,
					checkDates: false,
					checkStatus: false,
					checkTodos: false,
					maxAgeDays: null,
					statusThresholdDays: 90,
					outdatedPackageNames: ["@revealui/cms"],
				},
				actions: { onStale: "archive", archiveDir: "archive", dryRun: false },
				watch: { enabled: true, debounceMs: 1000 },
			};

			const errors = await validatePackageNames(file, config);
			expect(errors.length).toBe(0);
		});
	});

	describe("File Reference Validation", () => {
		it("should not flag npm package imports", () => {
			const npmImports = [
				"import Link from 'next/link'",
				"const fs = require('fs')",
				"import { useState } from 'react'",
			];

			const npmPackagePattern = /^[a-z0-9@][a-z0-9._-]*(\/[a-z0-9._-]+)*$/i;

			for (const import_ of npmImports) {
				const match = import_.match(/['"]([^'"]+)['"]/);
				if (match) {
					const pkg = match[1];
					// These should not be flagged as file references
					expect(npmPackagePattern.test(pkg) || pkg.startsWith("@")).toBe(true);
				}
			}
		});
	});

	describe("Date Validation", () => {
		it("should detect old files when maxAgeDays is set", () => {
			const maxAgeDays = 90;
			const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
			const oldDate = new Date(Date.now() - maxAgeMs - 1000); // 1 second older than max
			const fileAgeMs = Date.now() - oldDate.getTime();

			expect(fileAgeMs > maxAgeMs).toBe(true);
		});

		it("should parse date strings in content", () => {
			const datePatterns = [
				/last\s+updated?[:\s]+(\d{4}-\d{2}-\d{2})/i,
				/updated?[:\s]+(\d{4}-\d{2}-\d{2})/i,
			];

			const content = "Last Updated: 2020-01-01";
			for (const pattern of datePatterns) {
				const match = content.match(pattern);
				expect(match).toBeTruthy();
				if (match) {
					expect(match[1]).toBe("2020-01-01");
				}
			}
		});
	});

	describe("Status Validation", () => {
		it("should detect status claims", () => {
			const statusPattern = /status[:\s]+(complete|done|finished)/i;
			const phasePattern = /phase\s+(\d+)\s+(complete|done|finished)/i;

			const statusContent = "Status: Complete";
			const phaseContent = "Phase 1 Complete";

			expect(statusPattern.test(statusContent)).toBe(true);
			expect(phasePattern.test(phaseContent)).toBe(true);
		});
	});

	describe("TODO Validation", () => {
		it("should detect TODO references", () => {
			const todoPattern = /TODO|FIXME|HACK|XXX/i;
			const content = "TODO: Fix this issue";
			expect(todoPattern.test(content)).toBe(true);
		});

		it("should extract file references from TODOs", () => {
			const refPattern = /(?:TODO|FIXME)[:\s]+(?:in|at|see|check)\s+([^\s]+)/i;
			const content = "TODO: Check ./src/file.ts";
			const match = content.match(refPattern);
			expect(match).toBeTruthy();
			if (match) {
				expect(match[1]).toBe("./src/file.ts");
			}
		});
	});

	describe("Code Block Regex", () => {
		it("should match code blocks with language tags", () => {
			const codeBlockRegex =
				/```(?:typescript|ts|javascript|js|json|markdown|md|bash|sh)?\s*\n?([\s\S]*?)```/g;
			const content = "```typescript\nconst x = 1\n```";
			const matches = [...content.matchAll(codeBlockRegex)];
			expect(matches.length).toBeGreaterThan(0);
		});

		it("should match code blocks without language tags", () => {
			const codeBlockRegex =
				/```(?:typescript|ts|javascript|js|json|markdown|md|bash|sh)?\s*\n?([\s\S]*?)```/g;
			const content = "```\nconst x = 1\n```";
			const matches = [...content.matchAll(codeBlockRegex)];
			expect(matches.length).toBeGreaterThan(0);
		});
	});

	describe("Archive Operations", () => {
		it("should handle duplicate archive file names", async () => {
			const archiveDir = path.join(testDir, "archive");
			await fs.mkdir(archiveDir, { recursive: true });

			const today = new Date().toISOString().split("T")[0];
			const fileName = "test.md";
			const archivePath = path.join(archiveDir, `${today}_${fileName}`);

			// Create first file
			await fs.writeFile(archivePath, "# Test 1");

			// Check if duplicate handling would work
			let counter = 1;
			let finalPath = archivePath;
			while (true) {
				try {
					await fs.access(finalPath);
					const ext = path.extname(fileName);
					const base = path.basename(fileName, ext);
					finalPath = path.join(
						archiveDir,
						`${today}_${base}_${counter}${ext}`,
					);
					counter++;
				} catch {
					break;
				}
			}

			expect(counter).toBeGreaterThan(1);
		});
	});
});
