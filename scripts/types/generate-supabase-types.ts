#!/usr/bin/env tsx
/**
 * Generate Supabase TypeScript types
 *
 * Requires SUPABASE_ACCESS_TOKEN environment variable if not logged in via CLI
 * Run: supabase login (or set SUPABASE_ACCESS_TOKEN in .env file)
 *
 * Loads environment variables from:
 * - .env.development.local (development)
 * - .env.local (all environments)
 * - .env (all environments)
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env files (in priority order)
// Matches the pattern used in other scripts like init-database.ts
const projectRoot = resolve(__dirname, "../..");
const envFiles = [
	resolve(projectRoot, ".env.development.local"),
	resolve(projectRoot, ".env.local"),
	resolve(projectRoot, ".env"),
];

// Load env files in order (later files override earlier ones)
// This ensures SUPABASE_ACCESS_TOKEN is available from .env files
const loadedEnvFiles: string[] = [];
for (const envFile of envFiles) {
	if (existsSync(envFile)) {
		const result = config({ path: envFile, override: false }); // Don't override existing env vars
		if (!result.error) {
			loadedEnvFiles.push(envFile);
		} else {
			console.warn(
				`⚠️  Warning: Could not load ${envFile}: ${result.error.message}`,
			);
		}
	}
}

// Log which env files were loaded (for debugging)
if (loadedEnvFiles.length > 0) {
	console.log(`📁 Loaded environment from: ${loadedEnvFiles.join(", ")}`);
}

// Get configuration from environment variables (not hardcoded)
const projectId = process.env.SUPABASE_PROJECT_ID;
const schema = process.env.SUPABASE_SCHEMA || "public";
const outputFile = "./packages/services/src/supabase/types.ts";

if (!projectId) {
	console.error("❌ SUPABASE_PROJECT_ID environment variable is required");
	console.error("💡 Add SUPABASE_PROJECT_ID to your .env file");
	process.exit(1);
}

async function generateTypes() {
	// Check for access token (after loading .env files)
	const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

	console.log("🔍 Generating Supabase types...");

	if (accessToken) {
		console.log("✅ Found SUPABASE_ACCESS_TOKEN in environment");
	} else {
		console.log("⚠️  No SUPABASE_ACCESS_TOKEN found");
		console.log("💡 Tip: Add SUPABASE_ACCESS_TOKEN to .env file");
		console.log(
			"   Checked files:",
			envFiles.filter(existsSync).join(", ") || "none found",
		);
	}

	try {
		// Build command (Supabase CLI reads SUPABASE_ACCESS_TOKEN from env automatically)
		const command = `pnpm dlx supabase gen types --lang=typescript --project-id ${projectId} --schema ${schema}`;

		if (accessToken) {
			console.log("✅ Using SUPABASE_ACCESS_TOKEN from environment");
		} else {
			console.log("⚠️  No SUPABASE_ACCESS_TOKEN found - trying CLI login");
			console.log(
				'💡 Tip: Run "supabase login" or add SUPABASE_ACCESS_TOKEN to .env file',
			);
			console.log(
				"   Checked files:",
				envFiles.filter(existsSync).join(", ") || "none found",
			);
		}

		// Generate types - Supabase CLI will use SUPABASE_ACCESS_TOKEN from process.env
		const env = { ...process.env };
		if (accessToken) {
			env.SUPABASE_ACCESS_TOKEN = accessToken;
		}

		const types = execSync(command, {
			encoding: "utf-8",
			stdio: ["inherit", "pipe", "pipe"],
			env, // Pass env vars to child process
		});

		// Write to file
		const outputPath = join(process.cwd(), outputFile);
		writeFileSync(outputPath, types, "utf-8");

		console.log(`✅ Types generated successfully: ${outputFile}`);

		// Copy to generated types (if copy script exists)
		try {
			const { spawnSync } = await import("node:child_process");
			const copyResult = spawnSync(
				"tsx",
				["scripts/types/copy-generated-types.ts", "--supabase"],
				{
					stdio: "inherit",
					cwd: process.cwd(),
				},
			);

			if (copyResult.status === 0) {
				console.log("✅ Types copied to generated package");
			}
		} catch {
			console.warn("⚠️  Could not run copy script (this is okay)");
		}
	} catch (error: unknown) {
		console.error("❌ Failed to generate Supabase types");
		if (error instanceof Error) {
			console.error(error.message);
		}

		console.log("\n📝 Troubleshooting:");
		console.log("1. Run: supabase login");
		console.log("2. Or set: export SUPABASE_ACCESS_TOKEN=your_token");
		console.log(
			"3. Get token from: https://supabase.com/dashboard/account/tokens",
		);

		process.exit(1);
	}
}

generateTypes();
