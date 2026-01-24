import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		root: __dirname,
		include: [
			"**/__tests__/**/*.test.ts",
			"**/__tests__/**/*.spec.ts",
			"__tests__/**/*.test.ts",
			"__tests__/**/*.spec.ts",
		],
		exclude: ["**/node_modules/**", "**/dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["*.ts"],
			exclude: ["**/*.test.ts", "**/*.spec.ts", "__tests__/**"],
		},
	},
	resolve: {
		alias: {
			// Allow importing from scripts directory
			"@scripts": __dirname,
		},
	},
	esbuild: {
		// Support for .ts files with exports
		target: "node18",
	},
});
