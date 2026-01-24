#!/usr/bin/env node

/**
 * Component Inventory System
 *
 * Audits all components to determine working vs non-working status.
 * Creates comprehensive inventory for systematic engineering approach.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

interface ComponentInfo {
	path: string;
	name: string;
	type: "script" | "package" | "command" | "config";
	status: "working" | "broken" | "unknown";
	issues: string[];
	dependencies: string[];
	lastModified: Date;
	size: number;
}

interface InventoryReport {
	timestamp: Date;
	totalComponents: number;
	workingComponents: ComponentInfo[];
	brokenComponents: ComponentInfo[];
	unknownComponents: ComponentInfo[];
	summary: {
		scripts: { working: number; broken: number; unknown: number };
		packages: { working: number; broken: number; unknown: number };
		commands: { working: number; broken: number; unknown: number };
		configs: { working: number; broken: number; unknown: number };
	};
}

class ComponentInventory {
	private components: ComponentInfo[] = [];
	private report: InventoryReport;

	constructor() {
		this.report = {
			timestamp: new Date(),
			totalComponents: 0,
			workingComponents: [],
			brokenComponents: [],
			unknownComponents: [],
			summary: {
				scripts: { working: 0, broken: 0, unknown: 0 },
				packages: { working: 0, broken: 0, unknown: 0 },
				commands: { working: 0, broken: 0, unknown: 0 },
				configs: { working: 0, broken: 0, unknown: 0 },
			},
		};
	}

	async audit(): Promise<InventoryReport> {
		console.log("🔍 Component Inventory Audit");
		console.log("===========================\n");

		// Audit scripts
		await this.auditScripts();

		// Audit packages
		await this.auditPackages();

		// Audit commands
		await this.auditCommands();

		// Audit configs
		await this.auditConfigs();

		// Categorize and summarize
		this.categorizeComponents();
		this.generateSummary();

		console.log("\n📊 Inventory Complete");
		console.log(`Total components: ${this.report.totalComponents}`);
		console.log(`Working: ${this.report.workingComponents.length}`);
		console.log(`Broken: ${this.report.brokenComponents.length}`);
		console.log(`Unknown: ${this.report.unknownComponents.length}`);

		return this.report;
	}

	private async auditScripts(): Promise<void> {
		console.log("📜 Auditing scripts...");

		const scriptsDir = join(process.cwd(), "scripts");
		if (!existsSync(scriptsDir)) return;

		const scriptFiles = this.getAllFiles(scriptsDir, [".ts", ".js", ".mjs"]);

		for (const file of scriptFiles) {
			const component = await this.analyzeScript(file);
			this.components.push(component);
		}
	}

	private async auditPackages(): Promise<void> {
		console.log("📦 Auditing packages...");

		const packagesDir = join(process.cwd(), "packages");
		if (!existsSync(packagesDir)) return;

		const packageDirs = readdirSync(packagesDir)
			.map((name) => join(packagesDir, name))
			.filter((path) => statSync(path).isDirectory());

		for (const pkgDir of packageDirs) {
			const component = await this.analyzePackage(pkgDir);
			this.components.push(component);
		}

		// Also audit apps
		const appsDir = join(process.cwd(), "apps");
		if (existsSync(appsDir)) {
			const appDirs = readdirSync(appsDir)
				.map((name) => join(appsDir, name))
				.filter((path) => statSync(path).isDirectory());

			for (const appDir of appDirs) {
				const component = await this.analyzePackage(appDir);
				this.components.push(component);
			}
		}
	}

	private async auditCommands(): Promise<void> {
		console.log("⚡ Auditing commands...");

		const commandsDir = join(process.cwd(), ".cursor", "commands");
		if (!existsSync(commandsDir)) return;

		const commandFiles = readdirSync(commandsDir).filter(
			(file) => file.endsWith(".ts") || file.endsWith(".md"),
		);

		for (const file of commandFiles) {
			const component = await this.analyzeCommand(join(commandsDir, file));
			this.components.push(component);
		}
	}

	private async auditConfigs(): Promise<void> {
		console.log("⚙️  Auditing configs...");

		const configFiles = [
			"package.json",
			"tsconfig.json",
			"biome.json",
			"turbo.json",
			"pnpm-workspace.yaml",
			".cursorignore",
			".gitignore",
		];

		for (const file of configFiles) {
			if (existsSync(file)) {
				const component = await this.analyzeConfig(file);
				this.components.push(component);
			}
		}
	}

	private async analyzeScript(filePath: string): Promise<ComponentInfo> {
		const relativePath = relative(process.cwd(), filePath);
		const fileName = relativePath.split("/").pop() || "";
		const stat = statSync(filePath);

		const component: ComponentInfo = {
			path: relativePath,
			name: fileName.replace(/\.(ts|js|mjs)$/, ""),
			type: "script",
			status: "unknown",
			issues: [],
			dependencies: [],
			lastModified: stat.mtime,
			size: stat.size,
		};

		// Check if script has proper structure
		try {
			const content = readFileSync(filePath, "utf8");

			// Check for ESM imports
			if (content.includes("import ") && !content.includes("require(")) {
				// Good - ESM
			} else if (content.includes("require(") && !content.includes("import ")) {
				component.issues.push(
					"Uses CommonJS (require) instead of ESM (import)",
				);
				component.status = "broken";
			}

			// Check for TypeScript
			if (filePath.endsWith(".ts")) {
				if (
					!content.includes("interface ") &&
					!content.includes("type ") &&
					content.length > 100
				) {
					component.issues.push("TypeScript file without type definitions");
				}
			}

			// Try to execute syntax check
			try {
				execSync(`node --check "${filePath}"`, { timeout: 5000 });
			} catch (error) {
				component.issues.push(`Syntax error: ${error.message}`);
				component.status = "broken";
			}

			// Extract dependencies
			const importMatches =
				content.match(/import .* from ['"]([^'"]+)['"]/g) || [];
			component.dependencies = importMatches
				.map((match) => {
					const dep = match.match(/from ['"]([^'"]+)['"]/)?.[1] || "";
					return dep.startsWith("@/") ||
						dep.startsWith("../") ||
						dep.startsWith("./")
						? "internal"
						: dep;
				})
				.filter((dep) => dep && dep !== "internal");

			if (component.issues.length === 0) {
				component.status = "working";
			}
		} catch (error) {
			component.issues.push(`Cannot read file: ${error.message}`);
			component.status = "broken";
		}

		return component;
	}

	private async analyzePackage(pkgPath: string): Promise<ComponentInfo> {
		const relativePath = relative(process.cwd(), pkgPath);
		const pkgName = relativePath.split("/").pop() || "";
		const stat = statSync(pkgPath);

		const component: ComponentInfo = {
			path: relativePath,
			name: pkgName,
			type: "package",
			status: "unknown",
			issues: [],
			dependencies: [],
			lastModified: stat.mtime,
			size: stat.size,
		};

		const packageJsonPath = join(pkgPath, "package.json");
		if (!existsSync(packageJsonPath)) {
			component.issues.push("Missing package.json");
			component.status = "broken";
			return component;
		}

		try {
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

			// Check basic package structure
			if (!packageJson.name) {
				component.issues.push("Missing package name");
			}
			if (!packageJson.version) {
				component.issues.push("Missing package version");
			}

			// Check for build scripts
			const scripts = packageJson.scripts || {};
			if (!scripts.build && !scripts.dev) {
				component.issues.push("No build or dev scripts");
			}

			// Extract dependencies
			const deps = {
				...packageJson.dependencies,
				...packageJson.devDependencies,
			};
			component.dependencies = Object.keys(deps || {});

			// Try to run typecheck if it exists
			if (scripts.typecheck || scripts["typecheck:all"]) {
				try {
					execSync(
						`cd "${pkgPath}" && pnpm run ${scripts.typecheck ? "typecheck" : "typecheck:all"}`,
						{
							timeout: 10000,
							cwd: pkgPath,
						},
					);
				} catch (error) {
					component.issues.push(`TypeScript check failed: ${error.message}`);
					component.status = "broken";
				}
			}

			if (component.issues.length === 0) {
				component.status = "working";
			}
		} catch (error) {
			component.issues.push(`Invalid package.json: ${error.message}`);
			component.status = "broken";
		}

		return component;
	}

	private async analyzeCommand(filePath: string): Promise<ComponentInfo> {
		const relativePath = relative(process.cwd(), filePath);
		const fileName = relativePath.split("/").pop() || "";
		const stat = statSync(filePath);

		const component: ComponentInfo = {
			path: relativePath,
			name: fileName.replace(/\.(ts|md)$/, ""),
			type: "command",
			status: "unknown",
			issues: [],
			dependencies: [],
			lastModified: stat.mtime,
			size: stat.size,
		};

		try {
			const content = readFileSync(filePath, "utf8");

			if (filePath.endsWith(".md")) {
				// Markdown command - check structure
				if (
					!content.includes("## Overview") ||
					!content.includes("## How to Use")
				) {
					component.issues.push("Incomplete markdown command structure");
					component.status = "broken";
				} else {
					component.status = "working";
				}
			} else if (filePath.endsWith(".ts")) {
				// TypeScript command - check executability
				try {
					execSync(`node --check "${filePath}"`, { timeout: 5000 });
					component.status = "working";
				} catch (error) {
					component.issues.push(`Syntax error: ${error.message}`);
					component.status = "broken";
				}
			}
		} catch (error) {
			component.issues.push(`Cannot read command file: ${error.message}`);
			component.status = "broken";
		}

		return component;
	}

	private async analyzeConfig(filePath: string): Promise<ComponentInfo> {
		const relativePath = relative(process.cwd(), filePath);
		const fileName = relativePath.split("/").pop() || "";
		const stat = statSync(filePath);

		const component: ComponentInfo = {
			path: relativePath,
			name: fileName,
			type: "config",
			status: "unknown",
			issues: [],
			dependencies: [],
			lastModified: stat.mtime,
			size: stat.size,
		};

		try {
			const content = readFileSync(filePath, "utf8");

			// Basic validation based on file type
			if (fileName === "package.json") {
				try {
					JSON.parse(content);
					component.status = "working";
				} catch {
					component.issues.push("Invalid JSON syntax");
					component.status = "broken";
				}
			} else if (fileName.endsWith(".json")) {
				try {
					JSON.parse(content);
					component.status = "working";
				} catch {
					component.issues.push("Invalid JSON syntax");
					component.status = "broken";
				}
			} else if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
				// Basic YAML check
				if (content.trim().length > 0) {
					component.status = "working";
				} else {
					component.issues.push("Empty YAML file");
					component.status = "broken";
				}
			} else {
				// Other config files
				if (content.trim().length > 0) {
					component.status = "working";
				} else {
					component.issues.push("Empty config file");
					component.status = "broken";
				}
			}
		} catch (error) {
			component.issues.push(`Cannot read config file: ${error.message}`);
			component.status = "broken";
		}

		return component;
	}

	private getAllFiles(dir: string, extensions: string[]): string[] {
		const files: string[] = [];

		function scan(currentDir: string) {
			if (!existsSync(currentDir)) return;

			const items = readdirSync(currentDir);

			for (const item of items) {
				const fullPath = join(currentDir, item);
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					// Skip certain directories
					if (
						!item.startsWith(".") &&
						item !== "node_modules" &&
						item !== "__tests__"
					) {
						scan(fullPath);
					}
				} else if (extensions.includes(extname(item))) {
					files.push(fullPath);
				}
			}
		}

		scan(dir);
		return files;
	}

	private categorizeComponents(): void {
		for (const component of this.components) {
			switch (component.status) {
				case "working":
					this.report.workingComponents.push(component);
					break;
				case "broken":
					this.report.brokenComponents.push(component);
					break;
				default:
					this.report.unknownComponents.push(component);
			}
		}
	}

	private generateSummary(): void {
		this.report.totalComponents = this.components.length;

		// Count by type and status
		for (const component of this.components) {
			const typeStats = this.report.summary[component.type];
			typeStats[component.status]++;
		}
	}

	saveReport(): void {
		const reportPath = join(process.cwd(), "component-inventory.json");
		const report = {
			...this.report,
			workingComponents: this.report.workingComponents.map((c) => ({
				...c,
				lastModified: c.lastModified.toISOString(),
			})),
			brokenComponents: this.report.brokenComponents.map((c) => ({
				...c,
				lastModified: c.lastModified.toISOString(),
			})),
			unknownComponents: this.report.unknownComponents.map((c) => ({
				...c,
				lastModified: c.lastModified.toISOString(),
			})),
		};

		writeFileSync(reportPath, JSON.stringify(report, null, 2));
		console.log(`📄 Inventory report saved to: ${reportPath}`);
	}
}

async function main() {
	const inventory = new ComponentInventory();
	const report = await inventory.audit();

	console.log("\n📊 Component Inventory Summary:");
	console.log(
		`Scripts: ${report.summary.scripts.working} working, ${report.summary.scripts.broken} broken`,
	);
	console.log(
		`Packages: ${report.summary.packages.working} working, ${report.summary.packages.broken} broken`,
	);
	console.log(
		`Commands: ${report.summary.commands.working} working, ${report.summary.commands.broken} broken`,
	);
	console.log(
		`Configs: ${report.summary.configs.working} working, ${report.summary.configs.broken} broken`,
	);

	if (report.brokenComponents.length > 0) {
		console.log("\n🚨 Broken Components:");
		report.brokenComponents.forEach((comp) => {
			console.log(`  ❌ ${comp.path}: ${comp.issues.join(", ")}`);
		});
	}

	inventory.saveReport();
}

// ESM entry point check
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(console.error);
}

export { ComponentInventory, type ComponentInfo, type InventoryReport };
