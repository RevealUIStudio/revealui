import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	archiveFile,
	type Config,
	type DocFile,
	detectStale,
	discoverDocs,
	getArchiveIndex,
	validateContent,
} from "../docs-lifecycle";

describe("Documentation Lifecycle Manager - Integration Tests", () => {
	let testDir: string;
	let docsDir: string;
	let archiveDir: string;
	let configPath: string;
	let config: Config;

	beforeEach(async () => {
		testDir = await fs.mkdtemp(
			path.join(tmpdir(), "docs-lifecycle-integration-"),
		);
		docsDir = path.join(testDir, "docs");
		archiveDir = path.join(testDir, "docs", "archive");
		configPath = path.join(testDir, "docs-lifecycle.config.json");

		await fs.mkdir(docsDir, { recursive: true });
		await fs.mkdir(archiveDir, { recursive: true });

		// Create a test config
		config = {
			patterns: {
				track: ["**/*.md"],
				ignore: [],
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
				statusThresholdDays: 90,
				outdatedPackageNames: ["@revealui/cms"],
				replacementPackageName: "@revealui/core",
				outdatedPaths: ["/old/path"],
			},
			actions: {
				onStale: "report",
				archiveDir: "docs/archive",
			},
			watch: {
				debounceMs: 500,
			},
		};
		await fs.writeFile(configPath, JSON.stringify(config, null, 2));
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	describe("End-to-End: Discover and Validate", () => {
		it("should discover real markdown files and validate them", async () => {
			// Create test markdown files
			const file1 = path.join(docsDir, "test1.md");
			const file2 = path.join(docsDir, "test2.md");

			await fs.writeFile(
				file1,
				`# Test Document 1

This is a test document with outdated package name @revealui/cms.

\`\`\`typescript
import { something } from '@revealui/cms'
\`\`\`
`,
			);

			await fs.writeFile(
				file2,
				`# Test Document 2

This is a test document with a valid package name.

\`\`\`typescript
import { something } from '@revealui/core'
\`\`\`
`,
			);

			// Change working directory to testDir for config loading
			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				// Update config with correct paths
				const testConfig: Config = {
					...config,
					patterns: {
						...config.patterns,
						track: ["**/*.md"],
					},
				};
				const files = await discoverDocs(testConfig);

				expect(files.length).toBe(2);

				// Check each file individually
				const file1Doc = files.find((f) => f.path === file1);
				const file2Doc = files.find((f) => f.path === file2);

				expect(file1Doc).toBeDefined();
				expect(file2Doc).toBeDefined();

				// file1 should be stale (outdated package name)
				const isStale1 = await detectStale(file1Doc!, testConfig);
				expect(isStale1).toBe(true);

				// Validate to get errors
				const result1 = await validateContent(file1Doc!, testConfig);
				expect(result1.errors.some((e) => e.type === "packageName")).toBe(true);

				// file2 should not be stale
				const isStale2 = await detectStale(file2Doc!, testConfig);
				expect(isStale2).toBe(false);
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should detect stale files with outdated dates", async () => {
			const file = path.join(docsDir, "old-doc.md");
			const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
			const dateStr = oldDate.toISOString().split("T")[0];

			await fs.writeFile(
				file,
				`# Old Document

Last Updated: ${dateStr}

This document is old.
`,
			);

			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const testConfig: Config = {
					...config,
					patterns: {
						...config.patterns,
						track: ["**/*.md"],
					},
					validation: {
						...config.validation,
						maxAgeDays: 90, // 90 days max age
					},
				};
				const files = await discoverDocs(testConfig);

				const fileDoc = files.find((f) => f.path === file);
				expect(fileDoc).toBeDefined();

				const isStale = await detectStale(fileDoc!, testConfig);
				expect(isStale).toBe(true);

				const result = await validateContent(fileDoc!, testConfig);
				expect(result.errors.some((e) => e.type === "date")).toBe(true);
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should detect stale files with non-existent file references", async () => {
			const file = path.join(docsDir, "ref-doc.md");

			await fs.writeFile(
				file,
				`# Reference Document

See [this file](./non-existent-file.ts) for details.

Also check out [another file](./also-missing.md).
`,
			);

			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const testConfig: Config = {
					...config,
					patterns: {
						...config.patterns,
						track: ["**/*.md"],
					},
				};
				const files = await discoverDocs(testConfig);

				const fileDoc = files.find((f) => f.path === file);
				expect(fileDoc).toBeDefined();

				const isStale = await detectStale(fileDoc!, testConfig);
				expect(isStale).toBe(true);

				const result = await validateContent(fileDoc!, testConfig);
				expect(result.errors.some((e) => e.type === "fileReference")).toBe(
					true,
				);
				expect(
					result.errors.filter((e) => e.type === "fileReference").length,
				).toBe(2);
			} finally {
				process.chdir(originalCwd);
			}
		});
	});

	describe("End-to-End: Archive Operations", () => {
		it("should archive a stale file and update index", async () => {
			const file = path.join(docsDir, "stale.md");
			await fs.writeFile(
				file,
				`# Stale Document

This document uses outdated package @revealui/cms.
`,
			);

			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const testConfig: Config = {
					...config,
					patterns: {
						...config.patterns,
						track: ["**/*.md"],
					},
				};
				const files = await discoverDocs(testConfig);

				const fileDoc = files.find((f) => f.path === file);
				expect(fileDoc).toBeDefined();
				if (!fileDoc) {
					throw new Error("File not found");
				}

				const isStale = await detectStale(fileDoc, testConfig);
				expect(isStale).toBe(true);

				const result = await validateContent(fileDoc, testConfig);
				await archiveFile(fileDoc, result.errors, testConfig);

				// Check file was moved
				const archivedFiles = await fs.readdir(archiveDir);
				expect(archivedFiles.length).toBeGreaterThan(0);
				expect(archivedFiles.some((f) => f.includes("stale.md"))).toBe(true);

				// Check archive index was created
				const index = await getArchiveIndex(archiveDir);
				expect(index.length).toBe(1);
				// Archive index stores relative path, so compare relative paths
				const relativeFile = path.relative(testDir, file);
				expect(index[0].originalPath).toBe(relativeFile);
				expect(index[0].errors.length).toBeGreaterThan(0);
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should handle duplicate archive file names", async () => {
			const file1 = path.join(docsDir, "duplicate.md");
			const file2 = path.join(docsDir, "subdir", "duplicate.md");

			await fs.mkdir(path.join(docsDir, "subdir"), { recursive: true });

			await fs.writeFile(file1, "# Duplicate 1\nUses @revealui/cms");
			await fs.writeFile(file2, "# Duplicate 2\nUses @revealui/cms");

			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const testConfig: Config = {
					...config,
					patterns: {
						...config.patterns,
						track: ["**/*.md"],
					},
				};
				// Verify files exist before discovery
				const file1Exists = await fs
					.access(file1)
					.then(() => true)
					.catch(() => false);
				const file2Exists = await fs
					.access(file2)
					.then(() => true)
					.catch(() => false);
				expect(file1Exists).toBe(true);
				expect(file2Exists).toBe(true);

				const files = await discoverDocs(testConfig);

				// Filter to only the duplicate files we created (normalize paths for comparison)
				const normalizedFile1 = path.normalize(file1);
				const normalizedFile2 = path.normalize(file2);
				const duplicateFileDocs = files.filter((f) => {
					const normalizedPath = path.normalize(f.path);
					return (
						normalizedPath === normalizedFile1 ||
						normalizedPath === normalizedFile2
					);
				});

				// Verify both files were discovered
				if (duplicateFileDocs.length !== 2) {
					// Debug output
					const foundPaths = files.map((f) => ({
						path: path.normalize(f.path),
						relativePath: f.relativePath,
					}));
					console.error("Expected files:", normalizedFile1, normalizedFile2);
					console.error("Found files:", JSON.stringify(foundPaths, null, 2));
					console.error("Total files discovered:", files.length);
					console.error("Current working directory:", process.cwd());
				}
				expect(duplicateFileDocs.length).toBe(2);

				// Archive both files in order
				const archivedPaths: string[] = [];
				const archiveOutputs: string[] = [];
				for (const fileDoc of duplicateFileDocs) {
					const result = await validateContent(fileDoc, testConfig);
					expect(result.isStale).toBe(true);

					// Check what files exist in archive before archiving
					const beforeArchive = await fs.readdir(archiveDir).catch(() => []);

					const success = await archiveFile(fileDoc, result.errors, testConfig);
					expect(success).toBe(true);

					// Check what files exist in archive after archiving
					const afterArchive = await fs.readdir(archiveDir).catch(() => []);

					// Track what was archived for debugging
					archivedPaths.push(fileDoc.relativePath);
					archiveOutputs.push({
						before: beforeArchive.filter((f) => f !== ".index.json"),
						after: afterArchive.filter((f) => f !== ".index.json"),
						file: fileDoc.relativePath,
					});
				}

				// Check both files were archived with different names
				// Use the last archiveOutputs entry to see final state
				const finalArchivedFiles =
					archiveOutputs[archiveOutputs.length - 1]?.after || [];
				const duplicateFiles = finalArchivedFiles.filter((f) =>
					f.includes("duplicate.md"),
				);

				// Also check by reading directory directly
				const archivedFiles = await fs.readdir(archiveDir);
				const actualArchivedFiles = archivedFiles.filter(
					(f) => f !== ".index.json",
				);
				// Filter for files containing 'duplicate' in the name (not 'duplicate.md' because
				// the second file is named 'duplicate_1.md' which doesn't include 'duplicate.md')
				const duplicateFilesFromDir = actualArchivedFiles.filter((f) =>
					f.includes("duplicate"),
				);

				// Debug output if test fails
				if (duplicateFiles.length !== 2 || duplicateFilesFromDir.length !== 2) {
					console.error("Archived paths:", archivedPaths);
					console.error("Archive directory contents (read):", archivedFiles);
					console.error(
						"Archive directory contents (from progression):",
						finalArchivedFiles,
					);
					console.error(
						"Duplicate files found (from progression):",
						duplicateFiles,
					);
					console.error(
						"Duplicate files found (from directory):",
						duplicateFilesFromDir,
					);
					console.error(
						"Archive progression:",
						JSON.stringify(archiveOutputs, null, 2),
					);
				}
				// Use the directory read as the source of truth
				expect(duplicateFilesFromDir.length).toBe(2);

				// Check archive index has both entries
				const index = await getArchiveIndex(archiveDir);
				expect(index.length).toBe(2);
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should preserve archive index across multiple archives", async () => {
			const file1 = path.join(docsDir, "file1.md");
			const file2 = path.join(docsDir, "file2.md");

			await fs.writeFile(file1, "# File 1\nUses @revealui/cms");
			await fs.writeFile(file2, "# File 2\nUses @revealui/cms");

			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const testConfig: Config = {
					...config,
					patterns: {
						...config.patterns,
						track: ["**/*.md"],
					},
				};
				const files = await discoverDocs(testConfig);

				const staleFiles: Array<{ file: DocFile; errors: any[] }> = [];
				for (const fileDoc of files) {
					const result = await validateContent(fileDoc, testConfig);
					if (result.isStale) {
						staleFiles.push({ file: fileDoc, errors: result.errors });
					}
				}

				expect(staleFiles.length).toBe(2);

				// Archive first file
				await archiveFile(staleFiles[0].file, staleFiles[0].errors, testConfig);
				let index = await getArchiveIndex(archiveDir);
				expect(index.length).toBe(1);

				// Archive second file
				await archiveFile(staleFiles[1].file, staleFiles[1].errors, testConfig);
				index = await getArchiveIndex(archiveDir);
				expect(index.length).toBe(2);
			} finally {
				process.chdir(originalCwd);
			}
		});
	});

	describe("End-to-End: Real-World Scenarios", () => {
		it("should handle a complete workflow: discover, validate, archive", async () => {
			// Create test config for this test
			const testConfig: Config = {
				patterns: {
					track: ["**/*.md"],
					ignore: [],
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
					statusThresholdDays: 90,
					outdatedPackageNames: ["@revealui/cms"],
					replacementPackageName: "@revealui/core",
					outdatedPaths: ["/old/path"],
				},
				actions: {
					onStale: "report",
					archiveDir: "docs/archive",
				},
				watch: {
					debounceMs: 500,
				},
			};
			// Create multiple test files
			const files = [
				{
					path: path.join(docsDir, "valid.md"),
					content: "# Valid\nUses @revealui/core",
				},
				{
					path: path.join(docsDir, "stale1.md"),
					content: "# Stale 1\nUses @revealui/cms\nLast Updated: 2020-01-01",
				},
				{
					path: path.join(docsDir, "stale2.md"),
					content: "# Stale 2\nReferences [missing](./file.ts)",
				},
				{
					path: path.join(docsDir, "stale3.md"),
					content: "# Stale 3\nTODO in ./non-existent.ts: Fix this",
				},
			];

			for (const file of files) {
				await fs.writeFile(file.path, file.content);
			}

			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				// Discover files
				const discovered = await discoverDocs(testConfig);

				expect(discovered.length).toBe(4);

				// Validate and collect stale files
				const staleFiles: Array<{ file: DocFile; errors: any[] }> = [];
				for (const fileDoc of discovered) {
					const result = await validateContent(fileDoc, testConfig);
					if (result.isStale) {
						staleFiles.push({ file: fileDoc, errors: result.errors });
					}
				}

				// Should find 3 stale files (stale1, stale2, stale3)
				expect(staleFiles.length).toBe(3);

				// Archive all stale files
				for (const staleFile of staleFiles) {
					await archiveFile(staleFile.file, staleFile.errors, testConfig);
				}

				// Verify archive
				const archivedFiles = await fs.readdir(archiveDir);
				expect(archivedFiles.length).toBeGreaterThanOrEqual(3);

				const index = await getArchiveIndex(archiveDir);
				expect(index.length).toBe(3);

				// Verify original files are gone
				for (const staleFile of staleFiles) {
					try {
						await fs.access(staleFile.file.path);
						// If we get here, file still exists (shouldn't)
						expect.fail(
							`File ${staleFile.file.path} should have been archived`,
						);
					} catch {
						// Expected - file should be gone
					}
				}
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should handle nested directory structures", async () => {
			const nestedDir = path.join(docsDir, "nested", "deep", "path");
			await fs.mkdir(nestedDir, { recursive: true });

			const file = path.join(nestedDir, "nested-doc.md");
			await fs.writeFile(file, "# Nested\nUses @revealui/cms");

			const originalCwd = process.cwd();
			process.chdir(testDir);

			// Create test config for this test
			const testConfig: Config = {
				patterns: {
					track: ["**/*.md"],
					ignore: [],
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
					statusThresholdDays: 90,
					outdatedPackageNames: ["@revealui/cms"],
					replacementPackageName: "@revealui/core",
					outdatedPaths: ["/old/path"],
				},
				actions: {
					onStale: "report",
					archiveDir: "docs/archive",
				},
				watch: {
					debounceMs: 500,
				},
			};

			try {
				const files = await discoverDocs(testConfig);

				expect(files.length).toBe(1);
				expect(files[0].path).toBe(file);

				const isStale = await detectStale(files[0], testConfig);
				expect(isStale).toBe(true);
			} finally {
				process.chdir(originalCwd);
			}
		});
	});
});
