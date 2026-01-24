import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
	resolve: {
		alias: {
			dev: path.resolve(__dirname, "./src"),
		},
	},
	test: {
		include: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**"],
		environment: "node",
		globals: true,
		env: {
			VITEST: "true",
			NODE_ENV: "test",
		},
		pool: "threads",
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/**",
				"**/*.test.ts",
				"**/*.spec.ts",
				"dist/**",
				"**/__tests__/**",
			],
		},
	},
});
