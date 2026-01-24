#!/usr/bin/env tsx

/**
 * Unified Documentation Verification Script
 *
 * Verifies documentation quality across multiple dimensions:
 * - Links (internal, external, anchors)
 * - Versions (package versions in docs vs package.json)
 * - Commands (commands in docs vs package.json scripts)
 * - Paths (file paths referenced in docs)
 * - Code Examples (TypeScript code style validation)
 * - Consolidation (verifies consolidated files preserve content)
 *
 * Usage:
 *   pnpm docs:verify --all
 *   pnpm docs:verify --links
 *   pnpm docs:verify --versions --commands
 */

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { createLogger, getProjectRoot } from "../shared/utils.js";

const logger = createLogger();

// ============================================================================
// Shared Types and Utilities
// ============================================================================

interface VerificationModule {
	name: string;
	description: string;
	verify: (files: string[]) => Promise<VerificationResult>;
	generateReport: (result: VerificationResult) => Promise<string>;
	reportFileName: string;
}

interface VerificationResult {
	success: boolean;
	summary: Record<string, number | string>;
	issues: Array<{
		file: string;
		line: number;
		issue: string;
		[key: string]: unknown;
	}>;
	[key: string]: unknown;
}

/**
 * Find all markdown files in the project
 */
async function findMarkdownFiles(): Promise<string[]> {
	const files = await fg("**/*.md", {
		ignore: [
			"**/node_modules/**",
			"**/*/node_modules/**",
			"node_modules/**",
			".next/**",
			"dist/**",
			"docs/archive/**",
			"**/coverage/**",
		],
		cwd: process.cwd(),
		absolute: false,
	});

	// Filter out node_modules manually (fast-glob ignore sometimes doesn't work)
	return files
		.filter((f) => {
			const normalized = f.replace(/\\/g, "/");
			return !normalized.includes("node_modules");
		})
		.map((f) => path.resolve(process.cwd(), f));
}

/**
 * Write verification report to file
 */
async function writeReport(report: string, fileName: string): Promise<string> {
	const projectRoot = await getProjectRoot(import.meta.url);
	const reportPath = path.join(projectRoot, "docs", fileName);
	await fs.writeFile(reportPath, report, "utf-8");
	return reportPath;
}

// ============================================================================
// Links Verification Module
// ============================================================================

interface Link {
	file: string;
	line: number;
	text: string;
	url: string;
	type: "internal" | "external" | "anchor";
}

interface LinkIssue {
	file: string;
	line: number;
	link: string;
	issue: string;
	type: "broken-file" | "broken-anchor" | "broken-external" | "orphaned";
}

interface LinksVerificationResult extends VerificationResult {
	totalLinks: number;
	brokenLinks: LinkIssue[];
	orphanedFiles: string[];
	summary: {
		internal: number;
		external: number;
		anchors: number;
		broken: number;
		orphaned: number;
	};
}

const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

function extractLinks(content: string, filePath: string): Link[] {
	const links: Link[] = [];
	const lines = content.split("\n");

	lines.forEach((line, index) => {
		let match: RegExpExecArray | null;
		while ((match = LINK_REGEX.exec(line)) !== null) {
			const [, text, url] = match;
			const fullUrl = url.split(" ")[0]; // Remove title if present

			let type: "internal" | "external" | "anchor";
			if (
				fullUrl.startsWith("http://") ||
				fullUrl.startsWith("https://") ||
				fullUrl.startsWith("mailto:")
			) {
				type = "external";
			} else if (fullUrl.startsWith("#")) {
				type = "anchor";
			} else {
				type = "internal";
			}

			links.push({
				file: filePath,
				line: index + 1,
				text,
				url: fullUrl,
				type,
			});
		}
	});

	return links;
}

function extractAnchors(content: string): Set<string> {
	const anchors = new Set<string>();
	const lines = content.split("\n");

	lines.forEach((line) => {
		const match = line.match(/^#+\s+(.+)$/);
		if (match) {
			const heading = match[1];
			const anchor = heading
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "")
				.trim();
			if (anchor) {
				anchors.add(`#${anchor}`);
			}
		}
	});

	return anchors;
}

async function resolveInternalLink(
	linkUrl: string,
	fromFile: string,
): Promise<string | null> {
	const fromDir = path.dirname(fromFile);
	let targetPath: string;

	if (linkUrl.startsWith("/")) {
		targetPath = path.resolve(process.cwd(), linkUrl.slice(1));
	} else {
		targetPath = path.resolve(fromDir, linkUrl);
	}

	if (existsSync(targetPath)) {
		return targetPath;
	}

	if (!targetPath.endsWith(".md")) {
		const withMd = `${targetPath}.md`;
		if (existsSync(withMd)) {
			return withMd;
		}
	}

	return null;
}

async function verifyLinks(files: string[]): Promise<LinksVerificationResult> {
	const allLinks: Link[] = [];
	const fileContents = new Map<string, string>();
	const fileAnchors = new Map<string, Set<string>>();
	const linkedFiles = new Set<string>();

	for (const file of files) {
		const content = await fs.readFile(file, "utf-8");
		fileContents.set(file, content);
		const links = extractLinks(content, file);
		allLinks.push(...links);
		fileAnchors.set(file, extractAnchors(content));
	}

	const issues: LinkIssue[] = [];

	for (const link of allLinks) {
		if (link.type === "external") {
			continue;
		}

		if (link.type === "internal") {
			const resolved = await resolveInternalLink(link.url, link.file);
			if (!resolved) {
				issues.push({
					file: link.file,
					line: link.line,
					link: link.url,
					issue: `File not found: ${link.url}`,
					type: "broken-file",
				});
			} else {
				linkedFiles.add(resolved);
				const [filePath, anchor] = link.url.split("#");
				if (anchor) {
					const targetFile = await resolveInternalLink(filePath, link.file);
					if (targetFile) {
						const anchors = fileAnchors.get(targetFile);
						if (!anchors || !anchors.has(`#${anchor}`)) {
							issues.push({
								file: link.file,
								line: link.line,
								link: link.url,
								issue: `Anchor not found: #${anchor}`,
								type: "broken-anchor",
							});
						}
					}
				}
			}
		} else if (link.type === "anchor") {
			const anchor = link.url;
			const anchors = fileAnchors.get(link.file);
			if (!anchors || !anchors.has(anchor)) {
				const anchorWithoutHash = anchor.slice(1);
				const alternativeFormats = [
					`#${anchorWithoutHash}`,
					`#${anchorWithoutHash.toLowerCase()}`,
					`#${anchorWithoutHash.replace(/_/g, "-")}`,
					`#${anchorWithoutHash.replace(/-/g, "_")}`,
				];

				const found = alternativeFormats.some((alt) => anchors?.has(alt));
				if (!found) {
					issues.push({
						file: link.file,
						line: link.line,
						link: link.url,
						issue: `Anchor not found: ${anchor}`,
						type: "broken-anchor",
					});
				}
			}
		}
	}

	const orphanedFiles: string[] = [];
	for (const file of files) {
		if (
			file.endsWith("README.md") &&
			(file.includes("/README.md") || file.endsWith("README.md"))
		) {
			continue;
		}
		if (!linkedFiles.has(file)) {
			orphanedFiles.push(file);
		}
	}

	return {
		success: issues.length === 0 && orphanedFiles.length === 0,
		totalLinks: allLinks.length,
		brokenLinks: issues,
		orphanedFiles,
		summary: {
			internal: allLinks.filter((l) => l.type === "internal").length,
			external: allLinks.filter((l) => l.type === "external").length,
			anchors: allLinks.filter((l) => l.type === "anchor").length,
			broken: issues.length,
			orphaned: orphanedFiles.length,
		},
		issues: issues.map((i) => ({
			file: i.file,
			line: i.line,
			issue: i.issue,
			link: i.link,
			type: i.type,
		})),
	};
}

async function generateLinksReport(
	result: LinksVerificationResult,
): Promise<string> {
	const lines: string[] = [];
	lines.push("# Documentation Link Verification Report");
	lines.push("");
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push("");
	lines.push("## Summary");
	lines.push("");
	lines.push(`- **Total Links**: ${result.totalLinks}`);
	lines.push(`- **Internal Links**: ${result.summary.internal}`);
	lines.push(`- **External Links**: ${result.summary.external}`);
	lines.push(`- **Anchor Links**: ${result.summary.anchors}`);
	lines.push(`- **Broken Links**: ${result.brokenLinks.length}`);
	lines.push(`- **Orphaned Files**: ${result.orphanedFiles.length}`);
	lines.push("");

	if (result.brokenLinks.length > 0) {
		lines.push("## Broken Links");
		lines.push("");
		for (const issue of result.brokenLinks) {
			lines.push(
				`### ${path.relative(process.cwd(), issue.file)}:${issue.line}`,
			);
			lines.push("");
			lines.push(`- **Link**: \`${issue.link}\``);
			lines.push(`- **Issue**: ${issue.issue}`);
			lines.push(`- **Type**: ${issue.type}`);
			lines.push("");
		}
	}

	if (result.orphanedFiles.length > 0) {
		lines.push("## Orphaned Files");
		lines.push("");
		lines.push("These files are not linked from anywhere and may be unused:");
		lines.push("");
		for (const file of result.orphanedFiles) {
			lines.push(`- \`${path.relative(process.cwd(), file)}\``);
		}
		lines.push("");
	}

	if (result.brokenLinks.length === 0 && result.orphanedFiles.length === 0) {
		lines.push("✅ **All links verified successfully!**");
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// Versions Verification Module
// ============================================================================

interface VersionReference {
	file: string;
	line: number;
	package: string;
	documentedVersion: string;
	actualVersion: string | null;
	match: boolean;
}

interface VersionsVerificationResult extends VerificationResult {
	references: VersionReference[];
	mismatches: VersionReference[];
	summary: {
		total: number;
		matched: number;
		mismatched: number;
		notFound: number;
	};
}

async function findPackageJsonFiles(): Promise<string[]> {
	const files = await fg("**/package.json", {
		ignore: ["node_modules/**", ".next/**", "dist/**"],
		cwd: process.cwd(),
	});
	return files.map((f) => path.resolve(process.cwd(), f));
}

async function loadPackageVersions(): Promise<Map<string, string>> {
	const packageFiles = await findPackageJsonFiles();
	const versions = new Map<string, string>();

	const priorityFiles = packageFiles.sort((a, b) => {
		const aIsCms = a.includes("apps/cms");
		const bIsCms = b.includes("apps/cms");
		if (aIsCms && !bIsCms) return -1;
		if (!aIsCms && bIsCms) return 1;
		const aIsRoot = a.endsWith("/package.json") && !a.includes("/");
		const bIsRoot = b.endsWith("/package.json") && !b.includes("/");
		if (aIsRoot && !bIsRoot) return -1;
		if (!aIsRoot && bIsRoot) return 1;
		return 0;
	});

	for (const file of priorityFiles) {
		try {
			const content = await fs.readFile(file, "utf-8");
			const pkg = JSON.parse(content);

			const allDeps = {
				...(pkg.dependencies || {}),
				...(pkg.devDependencies || {}),
			};

			for (const [name, version] of Object.entries(allDeps)) {
				const key = name.toLowerCase();
				if (!versions.has(key)) {
					const cleanVersion = String(version).replace(/^[\^~>=<]/, "");
					versions.set(key, cleanVersion);
				}
			}

			if (pkg.dependencies?.react && !versions.has("react")) {
				versions.set("react", pkg.dependencies.react.replace(/^[\^~>=<]/, ""));
			}
			if (pkg.dependencies?.next && !versions.has("next")) {
				versions.set("next", pkg.dependencies.next.replace(/^[\^~>=<]/, ""));
			}
			if (pkg.devDependencies?.typescript && !versions.has("typescript")) {
				versions.set(
					"typescript",
					pkg.devDependencies.typescript.replace(/^[\^~>=<]/, ""),
				);
			}
		} catch (error) {
			logger.warning(
				`Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return versions;
}

function extractVersionReferences(
	content: string,
	filePath: string,
): VersionReference[] {
	const references: VersionReference[] = [];
	const lines = content.split("\n");

	let inCodeBlock = false;

	lines.forEach((line, index) => {
		if (line.trim().startsWith("```")) {
			inCodeBlock = !inCodeBlock;
			return;
		}

		if (inCodeBlock) return;

		const reactMatch = line.match(/(?:^|\s)React\s+(\d+)/i);
		if (reactMatch && !line.includes("@") && !line.includes("library")) {
			references.push({
				file: filePath,
				line: index + 1,
				package: "react",
				documentedVersion: reactMatch[1],
				actualVersion: null,
				match: false,
			});
		}

		const nextMatch = line.match(/Next\.js\s+(\d+)/i);
		if (nextMatch) {
			references.push({
				file: filePath,
				line: index + 1,
				package: "next",
				documentedVersion: nextMatch[1],
				actualVersion: null,
				match: false,
			});
		}

		const tsMatch = line.match(/TypeScript\s+(\d+\.\d+)/i);
		if (tsMatch) {
			references.push({
				file: filePath,
				line: index + 1,
				package: "typescript",
				documentedVersion: tsMatch[1],
				actualVersion: null,
				match: false,
			});
		}

		const nodeMatch = line.match(/Node\.js\s+(\d+\.\d+\.\d+)/i);
		if (nodeMatch) {
			references.push({
				file: filePath,
				line: index + 1,
				package: "node",
				documentedVersion: nodeMatch[1],
				actualVersion: null,
				match: false,
			});
		}

		const pnpmMatch = line.match(/pnpm\s+(\d+\.\d+\.\d+)/i);
		if (pnpmMatch) {
			references.push({
				file: filePath,
				line: index + 1,
				package: "pnpm",
				documentedVersion: pnpmMatch[1],
				actualVersion: null,
				match: false,
			});
		}
	});

	return references;
}

async function verifyVersions(
	files: string[],
): Promise<VersionsVerificationResult> {
	const versions = await loadPackageVersions();
	const allReferences: VersionReference[] = [];

	for (const file of files) {
		const content = await fs.readFile(file, "utf-8");
		const references = extractVersionReferences(content, file);
		allReferences.push(...references);
	}

	for (const ref of allReferences) {
		let actualVersion: string | null = null;

		if (ref.package === "node") {
			try {
				const rootPkg = JSON.parse(
					await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8"),
				);
				if (rootPkg.engines?.node) {
					actualVersion = rootPkg.engines.node.replace(/[>=<^~]/g, "");
				}
			} catch {
				// Ignore
			}
		} else if (ref.package === "pnpm") {
			try {
				const rootPkg = JSON.parse(
					await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8"),
				);
				if (rootPkg.packageManager?.startsWith("pnpm@")) {
					actualVersion = rootPkg.packageManager.replace("pnpm@", "");
				}
			} catch {
				// Ignore
			}
		} else {
			actualVersion = versions.get(ref.package.toLowerCase()) || null;
		}

		if (actualVersion) {
			ref.actualVersion = actualVersion;
			const docVersion = ref.documentedVersion.replace(/[>=<^~]/g, "");
			const actualVersionClean = actualVersion.replace(/[>=<^~]/g, "");

			if (docVersion.split(".").length === 1) {
				ref.match = actualVersionClean.startsWith(`${docVersion}.`);
			} else {
				const docParts = docVersion.split(".");
				const actualParts = actualVersionClean.split(".");
				ref.match =
					docParts[0] === actualParts[0] &&
					(docParts.length < 2 || docParts[1] === actualParts[1]);
			}
		}
	}

	const mismatches = allReferences.filter((ref) => {
		if (!ref.actualVersion) return true;
		return !ref.match;
	});

	return {
		success: mismatches.length === 0,
		references: allReferences,
		mismatches,
		summary: {
			total: allReferences.length,
			matched: allReferences.filter((r) => r.match).length,
			mismatched: mismatches.length,
			notFound: allReferences.filter((r) => !r.actualVersion).length,
		},
		issues: mismatches.map((m) => ({
			file: m.file,
			line: m.line,
			issue: `Version mismatch: documented ${m.documentedVersion}, actual ${m.actualVersion || "not found"}`,
			package: m.package,
		})),
	};
}

async function generateVersionsReport(
	result: VersionsVerificationResult,
): Promise<string> {
	const lines: string[] = [];
	lines.push("# Documentation Version Verification Report");
	lines.push("");
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push("");
	lines.push("## Summary");
	lines.push("");
	lines.push(`- **Total References**: ${result.summary.total}`);
	lines.push(`- **Matched**: ${result.summary.matched}`);
	lines.push(`- **Mismatched**: ${result.summary.mismatched}`);
	lines.push(`- **Not Found**: ${result.summary.notFound}`);
	lines.push("");

	if (result.mismatches.length > 0) {
		lines.push("## Version Mismatches");
		lines.push("");
		for (const mismatch of result.mismatches) {
			lines.push(
				`### ${path.relative(process.cwd(), mismatch.file)}:${mismatch.line}`,
			);
			lines.push("");
			lines.push(`- **Package**: ${mismatch.package}`);
			lines.push(`- **Documented**: ${mismatch.documentedVersion}`);
			if (mismatch.actualVersion) {
				lines.push(`- **Actual**: ${mismatch.actualVersion}`);
			} else {
				lines.push(`- **Actual**: Not found in package.json`);
			}
			lines.push("");
		}
	}

	if (result.mismatches.length === 0) {
		lines.push("✅ **All version references verified successfully!**");
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// Commands Verification Module
// ============================================================================

interface CommandReference {
	file: string;
	line: number;
	command: string;
	exists: boolean;
	scriptName: string | null;
}

interface CommandsVerificationResult extends VerificationResult {
	references: CommandReference[];
	missing: CommandReference[];
	summary: {
		total: number;
		found: number;
		missing: number;
	};
}

async function loadPackageScripts(): Promise<Set<string>> {
	const packageFiles = await fg("**/package.json", {
		ignore: ["node_modules/**", ".next/**", "dist/**"],
		cwd: process.cwd(),
	});

	const allScripts = new Set<string>();

	for (const file of packageFiles) {
		const filePath = path.resolve(process.cwd(), file);
		try {
			const content = await fs.readFile(filePath, "utf-8");
			const pkg = JSON.parse(content);
			if (pkg.scripts) {
				for (const scriptName of Object.keys(pkg.scripts)) {
					allScripts.add(scriptName);
					allScripts.add(`pnpm ${scriptName}`);
					allScripts.add(`pnpm run ${scriptName}`);
				}
			}
		} catch (error) {
			logger.warning(
				`Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return allScripts;
}

function extractCommands(
	content: string,
	filePath: string,
): CommandReference[] {
	const commands: CommandReference[] = [];
	const lines = content.split("\n");

	let inCodeBlock = false;
	let codeBlockLanguage = "";

	lines.forEach((line, index) => {
		const codeBlockStartMatch = line.match(/^```(\w+)?/);
		if (codeBlockStartMatch) {
			inCodeBlock = true;
			codeBlockLanguage = codeBlockStartMatch[1] || "";
			return;
		}

		if (line.trim() === "```") {
			inCodeBlock = false;
			return;
		}

		if (
			inCodeBlock &&
			(codeBlockLanguage === "bash" ||
				codeBlockLanguage === "sh" ||
				codeBlockLanguage === "shell" ||
				codeBlockLanguage === "powershell" ||
				codeBlockLanguage === "")
		) {
			if (
				line.trim().startsWith("#") ||
				line.includes("example") ||
				line.includes("Example")
			) {
				return;
			}

			const commandMatch = line.match(
				/^(pnpm|npm|yarn|node|tsx|bash|sh)\s+([^\s#\n]+)/,
			);
			if (commandMatch) {
				const [, tool, script] = commandMatch;

				if (script.startsWith("--") || script.startsWith("-")) {
					return;
				}

				const skipCommands = [
					"install",
					"add",
					"remove",
					"update",
					"list",
					"why",
					"run",
					"tsx",
					"licenses",
					"exec", // pnpm exec is a built-in command, not a script
				];
				if (skipCommands.includes(script)) {
					return;
				}

				if (
					tool === "pnpm" &&
					(script.startsWith("licenses") || script.startsWith("dlx"))
				) {
					return;
				}

				if ((tool === "node" || tool === "tsx") && script.includes("/")) {
					return;
				}

				if (tool === "pnpm" && script === "tsx") {
					return;
				}

				let fullCommand = `${tool} ${script}`;
				let scriptName = script;

				if (tool === "pnpm") {
					if (script.startsWith("run ")) {
						scriptName = script.replace("run ", "");
						fullCommand = `pnpm ${scriptName}`;
					} else if (script.startsWith("dlx ")) {
						return;
					} else {
						fullCommand = `pnpm ${script}`;
					}
				}

				commands.push({
					file: filePath,
					line: index + 1,
					command: fullCommand,
					exists: false,
					scriptName,
				});
			}
		}
	});

	return commands;
}

async function verifyCommands(
	files: string[],
): Promise<CommandsVerificationResult> {
	const scripts = await loadPackageScripts();
	const allReferences: CommandReference[] = [];

	for (const file of files) {
		const content = await fs.readFile(file, "utf-8");
		const commands = extractCommands(content, file);
		allReferences.push(...commands);
	}

	for (const ref of allReferences) {
		const normalizedCommand = ref.command
			.replace(/^pnpm run /, "pnpm ")
			.replace(/^pnpm /, "pnpm ");

		ref.exists =
			scripts.has(ref.command) ||
			scripts.has(ref.scriptName || "") ||
			scripts.has(normalizedCommand) ||
			scripts.has(ref.command.replace(/^pnpm /, ""));
	}

	const missing = allReferences.filter((ref) => !ref.exists);

	return {
		success: missing.length === 0,
		references: allReferences,
		missing,
		summary: {
			total: allReferences.length,
			found: allReferences.filter((r) => r.exists).length,
			missing: missing.length,
		},
		issues: missing.map((m) => ({
			file: m.file,
			line: m.line,
			issue: `Command not found: ${m.command}`,
			command: m.command,
			scriptName: m.scriptName,
		})),
	};
}

async function generateCommandsReport(
	result: CommandsVerificationResult,
): Promise<string> {
	const lines: string[] = [];
	lines.push("# Documentation Command Verification Report");
	lines.push("");
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push("");
	lines.push("## Summary");
	lines.push("");
	lines.push(`- **Total Commands**: ${result.summary.total}`);
	lines.push(`- **Found**: ${result.summary.found}`);
	lines.push(`- **Missing**: ${result.summary.missing}`);
	lines.push("");

	if (result.missing.length > 0) {
		lines.push("## Missing Commands");
		lines.push("");
		lines.push(
			"These commands are referenced in documentation but not found in package.json:",
		);
		lines.push("");
		for (const missing of result.missing) {
			lines.push(
				`### ${path.relative(process.cwd(), missing.file)}:${missing.line}`,
			);
			lines.push("");
			lines.push(`- **Command**: \`${missing.command}\``);
			lines.push(`- **Script Name**: ${missing.scriptName || "N/A"}`);
			lines.push("");
		}
	}

	if (result.missing.length === 0) {
		lines.push("✅ **All commands verified successfully!**");
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// Paths Verification Module
// ============================================================================

interface PathReference {
	file: string;
	line: number;
	path: string;
	exists: boolean;
	resolvedPath: string | null;
}

interface PathsVerificationResult extends VerificationResult {
	references: PathReference[];
	broken: PathReference[];
	summary: {
		total: number;
		found: number;
		broken: number;
	};
}

const LINK_PATH_REGEX =
	/\[([^\]]+)\]\(([^)]+\.(md|ts|tsx|js|jsx|json|yml|yaml|sh|ps1))\)/g;
const INLINE_CODE_PATH_REGEX =
	/`([^`]+\.(ts|tsx|js|jsx|json|md|yml|yaml|sh|ps1))`/g;

function extractPaths(content: string, filePath: string): PathReference[] {
	const paths: PathReference[] = [];
	const lines = content.split("\n");

	let inCodeBlock = false;

	lines.forEach((line, index) => {
		const codeBlockStartMatch = line.match(/^```(\w+)?/);
		if (codeBlockStartMatch) {
			inCodeBlock = true;
			return;
		}

		if (line.trim() === "```") {
			inCodeBlock = false;
			return;
		}

		let match: RegExpExecArray | null;
		while ((match = LINK_PATH_REGEX.exec(line)) !== null) {
			const filePathStr = match[2];
			if (
				!filePathStr.startsWith("http") &&
				!filePathStr.startsWith("mailto:") &&
				!filePathStr.startsWith("@")
			) {
				paths.push({
					file: filePath,
					line: index + 1,
					path: filePathStr,
					exists: false,
					resolvedPath: null,
				});
			}
		}

		if (inCodeBlock) {
			while ((match = INLINE_CODE_PATH_REGEX.exec(line)) !== null) {
				const filePathStr = match[1];
				const lineBefore = line.substring(0, match.index).trim();
				const lineAfter = line.substring(match.index + match[0].length).trim();
				const isInProse =
					(lineBefore.length > 0 && !lineBefore.endsWith("`")) ||
					(lineAfter.length > 0 && !lineAfter.startsWith("`"));

				if (
					!isInProse &&
					!filePathStr.startsWith("http") &&
					!filePathStr.startsWith("mailto:") &&
					!filePathStr.startsWith("@") &&
					!filePathStr.startsWith("npm:") &&
					!filePathStr.startsWith("node:") &&
					(filePathStr.includes("/") || filePathStr.includes("\\")) &&
					filePathStr.match(/\.(ts|tsx|js|jsx|json|md|yml|yaml|sh|ps1)$/)
				) {
					paths.push({
						file: filePath,
						line: index + 1,
						path: filePathStr,
						exists: false,
						resolvedPath: null,
					});
				}
			}
		}
	});

	return paths;
}

async function resolvePath(
	filePath: string,
	fromFile: string,
): Promise<string | null> {
	const fromDir = path.dirname(fromFile);
	let targetPath: string;

	if (filePath.startsWith("/")) {
		targetPath = path.resolve(process.cwd(), filePath.slice(1));
	} else {
		targetPath = path.resolve(fromDir, filePath);
	}

	if (existsSync(targetPath)) {
		return targetPath;
	}

	const ext = path.extname(targetPath);
	if (!ext) {
		const extensions = [".md", ".ts", ".tsx", ".js", ".jsx", ".json"];
		for (const ext of extensions) {
			const withExt = `${targetPath}${ext}`;
			if (existsSync(withExt)) {
				return withExt;
			}
		}
	}

	return null;
}

async function verifyPaths(files: string[]): Promise<PathsVerificationResult> {
	const allReferences: PathReference[] = [];

	for (const file of files) {
		const content = await fs.readFile(file, "utf-8");
		const paths = extractPaths(content, file);
		allReferences.push(...paths);
	}

	for (const ref of allReferences) {
		const resolved = await resolvePath(ref.path, ref.file);
		if (resolved) {
			ref.exists = true;
			ref.resolvedPath = resolved;
		}
	}

	const broken = allReferences.filter((ref) => !ref.exists);

	return {
		success: broken.length === 0,
		references: allReferences,
		broken,
		summary: {
			total: allReferences.length,
			found: allReferences.filter((r) => r.exists).length,
			broken: broken.length,
		},
		issues: broken.map((b) => ({
			file: b.file,
			line: b.line,
			issue: `Path not found: ${b.path}`,
			path: b.path,
		})),
	};
}

async function generatePathsReport(
	result: PathsVerificationResult,
): Promise<string> {
	const lines: string[] = [];
	lines.push("# Documentation File Path Verification Report");
	lines.push("");
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push("");
	lines.push("## Summary");
	lines.push("");
	lines.push(`- **Total Paths**: ${result.summary.total}`);
	lines.push(`- **Found**: ${result.summary.found}`);
	lines.push(`- **Broken**: ${result.summary.broken}`);
	lines.push("");

	if (result.broken.length > 0) {
		lines.push("## Broken Paths");
		lines.push("");
		for (const broken of result.broken) {
			lines.push(
				`### ${path.relative(process.cwd(), broken.file)}:${broken.line}`,
			);
			lines.push("");
			lines.push(`- **Path**: \`${broken.path}\``);
			lines.push("");
		}
	}

	if (result.broken.length === 0) {
		lines.push("✅ **All paths verified successfully!**");
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// Code Examples Verification Module
// ============================================================================

interface CodeExample {
	file: string;
	line: number;
	language: string;
	code: string;
	errors: string[];
}

interface CodeExamplesVerificationResult extends VerificationResult {
	examples: CodeExample[];
	withErrors: CodeExample[];
	summary: {
		total: number;
		typescript: number;
		withErrors: number;
	};
}

const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g;

function extractCodeExamples(content: string, filePath: string): CodeExample[] {
	const examples: CodeExample[] = [];
	let currentLine = 0;

	let match: RegExpExecArray | null;
	while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
		const language = match[1] || "";
		const code = match[2];

		const beforeMatch = content.substring(0, match.index);
		currentLine = beforeMatch.split("\n").length;

		if (language === "typescript" || language === "ts" || language === "tsx") {
			examples.push({
				file: filePath,
				line: currentLine,
				language,
				code,
				errors: [],
			});
		}
	}

	return examples;
}

function validateTypeScriptCode(code: string): string[] {
	const errors: string[] = [];

	try {
		if (code.includes("require(") && code.includes("import")) {
			errors.push("Mixing CommonJS (require) and ESM (import)");
		}

		if (code.includes("module.exports")) {
			errors.push("Using CommonJS (module.exports) instead of ESM (export)");
		}

		const doubleQuotes = code.match(/"[^"]*"/g);
		if (doubleQuotes && doubleQuotes.length > 0) {
			const jsxAttributeQuotes = code.match(/<[^>]+="[^"]*"/g);
			const nonJsxQuotes = doubleQuotes.filter(
				(q) => !jsxAttributeQuotes?.some((jq) => jq.includes(q)),
			);
			if (nonJsxQuotes.length > 0) {
				errors.push(
					`Using double quotes for strings (should use single quotes per project rules)`,
				);
			}
		}

		const linesWithSemicolons = code.split("\n").filter((line) => {
			const trimmed = line.trim();
			return (
				trimmed.endsWith(";") &&
				!trimmed.startsWith("//") &&
				!trimmed.includes("for(") &&
				!trimmed.includes("while(")
			);
		});
		if (linesWithSemicolons.length > 0) {
			errors.push(
				`Unnecessary semicolons found (should be omitted per project rules)`,
			);
		}
	} catch (error) {
		errors.push(`Validation error: ${error}`);
	}

	return errors;
}

async function verifyCodeExamples(
	files: string[],
): Promise<CodeExamplesVerificationResult> {
	const allExamples: CodeExample[] = [];

	for (const file of files) {
		const content = await fs.readFile(file, "utf-8");
		const examples = extractCodeExamples(content, file);
		allExamples.push(...examples);
	}

	for (const example of allExamples) {
		example.errors = validateTypeScriptCode(example.code);
	}

	const withErrors = allExamples.filter((ex) => ex.errors.length > 0);

	return {
		success: withErrors.length === 0,
		examples: allExamples,
		withErrors,
		summary: {
			total: allExamples.length,
			typescript: allExamples.filter(
				(ex) => ex.language === "typescript" || ex.language === "ts",
			).length,
			withErrors: withErrors.length,
		},
		issues: withErrors.map((e) => ({
			file: e.file,
			line: e.line,
			issue: `Code example errors: ${e.errors.join(", ")}`,
			errors: e.errors,
		})),
	};
}

async function generateCodeExamplesReport(
	result: CodeExamplesVerificationResult,
): Promise<string> {
	const lines: string[] = [];
	lines.push("# Documentation Code Example Verification Report");
	lines.push("");
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push("");
	lines.push("## Summary");
	lines.push("");
	lines.push(`- **Total Examples**: ${result.summary.total}`);
	lines.push(`- **TypeScript Examples**: ${result.summary.typescript}`);
	lines.push(`- **With Errors**: ${result.summary.withErrors}`);
	lines.push("");

	if (result.withErrors.length > 0) {
		lines.push("## Examples with Errors");
		lines.push("");
		for (const example of result.withErrors) {
			lines.push(
				`### ${path.relative(process.cwd(), example.file)}:${example.line}`,
			);
			lines.push("");
			for (const error of example.errors) {
				lines.push(`- ${error}`);
			}
			lines.push("");
			lines.push("```typescript");
			lines.push(example.code.split("\n").slice(0, 10).join("\n"));
			if (example.code.split("\n").length > 10) {
				lines.push("// ... (truncated)");
			}
			lines.push("```");
			lines.push("");
		}
	}

	if (result.withErrors.length === 0) {
		lines.push("✅ **All code examples verified successfully!**");
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// Consolidation Verification Module
// ============================================================================

interface ConsolidationMapping {
	consolidated: string;
	sources: string[];
}

interface ConsolidationVerificationResult extends VerificationResult {
	mappings: ConsolidationMapping[];
	missingContent: Array<{
		consolidated: string;
		source: string;
		missing: string[];
	}>;
	summary: {
		total: number;
		verified: number;
		withMissing: number;
	};
}

const CONSOLIDATIONS: ConsolidationMapping[] = [
	{
		consolidated: "docs/DRIZZLE-GUIDE.md",
		sources: [
			"docs/archive/technical-analysis/DRIZZLE-RESEARCH-SUMMARY.md",
			"docs/archive/technical-analysis/DRIZZLE-COMPATIBILITY-ANALYSIS.md",
			"docs/archive/technical-analysis/DRIZZLE-IMPLEMENTATION-FIXES.md",
		],
	},
	{
		consolidated: "docs/VALIDATION-GUIDE.md",
		sources: [
			"docs/archive/technical-analysis/AUTOMATED-VALIDATION-GUIDE.md",
			"docs/archive/technical-analysis/MANUAL-VALIDATION-GUIDE.md",
			"docs/archive/technical-analysis/AUTOMATION-QUICK-START.md",
		],
	},
];

function extractKeyContent(content: string): Set<string> {
	const keyContent = new Set<string>();

	const headings = content.match(/^#+\s+(.+)$/gm);
	if (headings) {
		headings.forEach((h) => {
			const heading = h.replace(/^#+\s+/, "").trim();
			keyContent.add(`heading:${heading}`);
		});
	}

	const codeBlocks = content.match(/```[\s\S]*?```/g);
	if (codeBlocks) {
		codeBlocks.forEach((block, index) => {
			const hash = block.substring(0, 100).replace(/\s/g, "");
			keyContent.add(`code:${index}:${hash}`);
		});
	}

	const importantLines = content.split("\n").filter((line) => {
		const lower = line.toLowerCase();
		return (
			lower.includes("important:") ||
			lower.includes("warning:") ||
			lower.includes("note:") ||
			lower.includes("critical:") ||
			lower.includes("status:")
		);
	});
	importantLines.forEach((line) => {
		keyContent.add(`important:${line.trim().substring(0, 100)}`);
	});

	return keyContent;
}

async function verifyConsolidation(
	mapping: ConsolidationMapping,
): Promise<string[]> {
	const missing: string[] = [];

	if (!existsSync(mapping.consolidated)) {
		missing.push(`Consolidated file not found: ${mapping.consolidated}`);
		return missing;
	}

	const consolidatedContent = await fs.readFile(mapping.consolidated, "utf-8");
	const consolidatedKeys = extractKeyContent(consolidatedContent);

	for (const source of mapping.sources) {
		if (!existsSync(source)) {
			continue;
		}

		const sourceContent = await fs.readFile(source, "utf-8");
		const sourceKeys = extractKeyContent(sourceContent);

		for (const key of sourceKeys) {
			if (!consolidatedKeys.has(key)) {
				const keyType = key.split(":")[0];
				const keyValue = key.split(":").slice(1).join(":");

				if (keyType === "heading") {
					const headingExists = consolidatedContent
						.toLowerCase()
						.includes(keyValue.toLowerCase());
					if (!headingExists) {
						missing.push(
							`Missing heading from ${path.basename(source)}: ${keyValue}`,
						);
					}
				} else if (keyType === "important") {
					const contentExists = consolidatedContent
						.toLowerCase()
						.includes(keyValue.toLowerCase().substring(0, 50));
					if (!contentExists) {
						missing.push(
							`Missing important content from ${path.basename(source)}`,
						);
					}
				}
			}
		}
	}

	return missing;
}

async function verifyConsolidations(
	_files: string[],
): Promise<ConsolidationVerificationResult> {
	const mappings: ConsolidationMapping[] = [];

	for (const mapping of CONSOLIDATIONS) {
		if (existsSync(mapping.consolidated)) {
			mappings.push(mapping);
		}
	}

	const missingContent: Array<{
		consolidated: string;
		source: string;
		missing: string[];
	}> = [];

	for (const mapping of mappings) {
		const missing = await verifyConsolidation(mapping);
		if (missing.length > 0) {
			missingContent.push({
				consolidated: mapping.consolidated,
				source: mapping.sources.join(", "),
				missing,
			});
		}
	}

	return {
		success: missingContent.length === 0,
		mappings,
		missingContent,
		summary: {
			total: mappings.length,
			verified: mappings.length - missingContent.length,
			withMissing: missingContent.length,
		},
		issues: missingContent.flatMap((mc) =>
			mc.missing.map((m) => ({
				file: mc.consolidated,
				line: 0,
				issue: m,
				source: mc.source,
			})),
		),
	};
}

async function generateConsolidationReport(
	result: ConsolidationVerificationResult,
): Promise<string> {
	const lines: string[] = [];
	lines.push("# Documentation Consolidation Verification Report");
	lines.push("");
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push("");
	lines.push("## Summary");
	lines.push("");
	lines.push(`- **Total Consolidations**: ${result.summary.total}`);
	lines.push(`- **Verified**: ${result.summary.verified}`);
	lines.push(`- **With Missing Content**: ${result.summary.withMissing}`);
	lines.push("");

	if (result.missingContent.length > 0) {
		lines.push("## Missing Content");
		lines.push("");
		for (const item of result.missingContent) {
			lines.push(`### ${item.consolidated}`);
			lines.push("");
			lines.push(`**Source Files**: ${item.source}`);
			lines.push("");
			lines.push("**Missing Content**:");
			lines.push("");
			for (const missing of item.missing) {
				lines.push(`- ${missing}`);
			}
			lines.push("");
		}
	}

	if (result.missingContent.length === 0) {
		lines.push("✅ **All consolidations verified successfully!**");
		lines.push("");
	}

	return lines.join("\n");
}

// ============================================================================
// Verification Modules Registry
// ============================================================================

const VERIFICATION_MODULES: VerificationModule[] = [
	{
		name: "links",
		description: "Verify all markdown links (internal, external, anchors)",
		verify: async (files) => verifyLinks(files),
		generateReport: generateLinksReport,
		reportFileName: "VERIFICATION-REPORT.md",
	},
	{
		name: "versions",
		description: "Verify version numbers match package.json",
		verify: async (files) => verifyVersions(files),
		generateReport: generateVersionsReport,
		reportFileName: "VERSION-VERIFICATION-REPORT.md",
	},
	{
		name: "commands",
		description: "Verify commands exist in package.json scripts",
		verify: async (files) => verifyCommands(files),
		generateReport: generateCommandsReport,
		reportFileName: "COMMAND-VERIFICATION-REPORT.md",
	},
	{
		name: "paths",
		description: "Verify file paths referenced in docs exist",
		verify: async (files) => verifyPaths(files),
		generateReport: generatePathsReport,
		reportFileName: "PATH-VERIFICATION-REPORT.md",
	},
	{
		name: "code-examples",
		description: "Validate TypeScript code examples",
		verify: async (files) => verifyCodeExamples(files),
		generateReport: generateCodeExamplesReport,
		reportFileName: "CODE-EXAMPLE-VERIFICATION-REPORT.md",
	},
	{
		name: "consolidation",
		description: "Verify consolidated files preserve content",
		verify: async (files) => verifyConsolidations(files),
		generateReport: generateConsolidationReport,
		reportFileName: "CONSOLIDATION-VERIFICATION-REPORT.md",
	},
];

// ============================================================================
// Main Verification Logic
// ============================================================================

interface VerificationRunResult {
	module: string;
	success: boolean;
	result: VerificationResult;
	reportPath?: string;
}

async function runVerifications(
	modules: string[],
): Promise<VerificationRunResult[]> {
	const files = await findMarkdownFiles();
	logger.info(`Found ${files.length} markdown files to verify\n`);

	const results: VerificationRunResult[] = [];

	for (const moduleName of modules) {
		const module = VERIFICATION_MODULES.find((m) => m.name === moduleName);
		if (!module) {
			logger.warning(`Unknown verification module: ${moduleName}`);
			continue;
		}

		logger.info(`🔍 Verifying ${module.description}...`);
		try {
			const result = await module.verify(files);
			const report = await module.generateReport(result as never);
			const reportPath = await writeReport(report, module.reportFileName);

			results.push({
				module: moduleName,
				success: result.success,
				result,
				reportPath,
			});

			if (result.success) {
				logger.success(`  ✅ ${moduleName} passed`);
			} else {
				logger.error(
					`  ❌ ${moduleName} failed (${result.issues.length} issues)`,
				);
			}
		} catch (error) {
			logger.error(
				`  ❌ ${moduleName} error: ${error instanceof Error ? error.message : String(error)}`,
			);
			results.push({
				module: moduleName,
				success: false,
				result: {
					success: false,
					summary: {},
					issues: [
						{
							file: "",
							line: 0,
							issue: error instanceof Error ? error.message : String(error),
						},
					],
				},
			});
		}
	}

	return results;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArguments(): string[] {
	const args = process.argv.slice(2);
	const modules: string[] = [];

	// Check if --all is explicitly passed
	if (args.includes("--all")) {
		return VERIFICATION_MODULES.map((m) => m.name);
	}

	// Extract module names from --module-name arguments
	for (const arg of args) {
		if (arg.startsWith("--")) {
			const moduleName = arg.slice(2);
			// Find module by exact name or by matching kebab-case
			const module = VERIFICATION_MODULES.find(
				(m) =>
					m.name === moduleName || m.name === moduleName.replace(/-/g, "-"),
			);
			if (module) {
				modules.push(module.name);
			} else if (moduleName !== "all") {
				// Only warn if it's not 'all' (which we already handled)
				logger.warning(`Unknown verification type: ${moduleName}`);
			}
		}
	}

	// If no modules specified, default to all
	return modules.length > 0 ? modules : VERIFICATION_MODULES.map((m) => m.name);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
	try {
		await getProjectRoot(import.meta.url);
		logger.header("Documentation Verification");

		const modulesToRun = parseArguments();

		if (modulesToRun.length === 0) {
			logger.error("No verification modules specified");
			process.exit(1);
		}

		logger.info(
			`Running ${modulesToRun.length} verification(s): ${modulesToRun.join(", ")}\n`,
		);

		const results = await runVerifications(modulesToRun);

		logger.info("\n\n📊 Verification Summary:\n");

		let allPassed = true;
		for (const result of results) {
			const status = result.success ? "✅" : "❌";
			logger.info(`${status} ${result.module}`);
			if (result.reportPath) {
				logger.info(
					`   Report: ${path.relative(process.cwd(), result.reportPath)}`,
				);
			}
			if (!result.success) {
				allPassed = false;
			}
		}

		logger.info("");

		if (allPassed) {
			logger.success("✅ All verifications passed!");
			process.exit(0);
		} else {
			logger.error("❌ Some verifications failed. See reports for details.");
			process.exit(1);
		}
	} catch (error) {
		logger.error(
			`Verification failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		if (error instanceof Error && error.stack) {
			logger.error(`Stack trace: ${error.stack}`);
		}
		process.exit(1);
	}
}

main();
