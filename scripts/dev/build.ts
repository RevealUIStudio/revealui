#!/usr/bin/env tsx
/**
 * Build Script for RevealUI Framework
 *
 * Builds all packages and applications in the monorepo.
 *
 * Usage:
 *   pnpm tsx scripts/dev/build.ts [--clean] [--watch] [--verbose]
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createLogger, getProjectRoot } from "../shared/utils.js";

const logger = createLogger();

interface BuildOptions {
	clean?: boolean;
	watch?: boolean;
	verbose?: boolean;
}

function parseArgs(): BuildOptions {
	const args = process.argv.slice(2);
	return {
		clean: args.includes("--clean"),
		watch: args.includes("--watch"),
		verbose: args.includes("--verbose"),
	};
}

async function runCommand(
	command: string,
	args: string[],
	options: { cwd?: string; description: string; verbose?: boolean },
): Promise<number> {
	return new Promise((resolve) => {
		logger.info(`🔧 ${options.description}...`);

		const child = spawn(command, args, {
			stdio: options.verbose ? "inherit" : ["ignore", "pipe", "pipe"],
			cwd: options.cwd || process.cwd(),
			env: process.env,
		});

		if (!options.verbose) {
			let _stdout = "";
			let stderr = "";

			child.stdout?.on("data", (data) => {
				_stdout += data.toString();
			});

			child.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			child.on("close", (code) => {
				if (code === 0) {
					logger.success(`${options.description} completed`);
				} else {
					logger.error(`${options.description} failed`);
					if (stderr) logger.error(stderr);
				}
				resolve(code || 0);
			});
		} else {
			child.on("close", (code) => {
				resolve(code || 0);
			});
		}

		child.on("error", (error) => {
			logger.error(`Failed to run ${options.description}: ${error.message}`);
			resolve(1);
		});
	});
}

async function runBuild() {
	try {
		await getProjectRoot(import.meta.url);
		const options = parseArgs();

		logger.header("RevealUI Build System");

		if (options.clean) {
			logger.info("🧹 Cleaning previous builds...\n");

			// Clean turbo cache
			await runCommand("pnpm", ["turbo", "clean"], {
				description: "Clean turbo cache",
			});

			// Clean Next.js cache
			const nextCache = join(process.cwd(), "apps/web/.next");
			if (existsSync(nextCache)) {
				await runCommand("rm", ["-rf", nextCache], {
					description: "Clean Next.js cache",
				});
			}

			logger.info("");
		}

		// Type check first
		logger.info("🔍 Running type checks...\n");
		const typeCheckCode = await runCommand("pnpm", ["typecheck"], {
			description: "TypeScript type checking",
		});

		if (typeCheckCode !== 0) {
			logger.error(
				"\n❌ Type checking failed. Fix type errors before building.",
			);
			process.exit(1);
		}

		// Lint check
		logger.info("\n🔍 Running lint checks...\n");
		const lintCode = await runCommand("pnpm", ["lint"], {
			description: "ESLint checks",
		});

		if (lintCode !== 0) {
			logger.error("\n❌ Linting failed. Fix lint errors before building.");
			process.exit(1);
		}

		// Main build
		logger.info("\n🔨 Building all packages...\n");
		const buildArgs = ["turbo", "build"];
		if (options.watch) {
			buildArgs.push("--watch");
		}

		const buildCode = await runCommand("pnpm", buildArgs, {
			description: options.watch ? "Build (watch mode)" : "Build all packages",
		});

		if (buildCode !== 0) {
			logger.error("\n❌ Build failed.");
			process.exit(1);
		}

		if (!options.watch) {
			logger.success("\n🎉 All builds completed successfully!");
			logger.info("   Your packages are ready for deployment.");
		}
	} catch (error) {
		logger.error(
			`Build failed: ${error instanceof Error ? error.message : String(error)}`,
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
		await runBuild();
	} catch (error) {
		logger.error(
			`Script failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

main();
