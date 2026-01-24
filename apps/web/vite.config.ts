import path from "node:path";
import { fileURLToPath } from "node:url";
import devServer from "@hono/vite-dev-server";
import react from "@vitejs/plugin-react-swc";
import sharedViteConfig from "dev/vite";
import dotenv from "dotenv";
import { defineConfig } from "vite";
import { ViteMcp } from "vite-plugin-mcp";

type ReactPluginOptions = Parameters<typeof react>[0] & {
	swcOptions?: {
		jsc?: {
			experimental?: {
				plugins?: Array<[string, Record<string, unknown>]>;
			};
		};
	};
};

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

dotenv.config({
	path: path.resolve(dirname, "../../.env.development.local"),
});

export default defineConfig(({ command }) => ({
	...sharedViteConfig,
	resolve: {
		...sharedViteConfig.resolve,
		alias: {
			...sharedViteConfig.resolve?.alias,
			// "@revealui/core": path.resolve(dirname, "../../packages/core/src"),
			// "@revealui/core/richtext": path.resolve(
			// 	dirname,
			// 	"../../packages/core/src/richtext/index.ts",
			// ),
		},
	},
	plugins: [
		react({
			swcOptions: {
				jsc: {
					experimental: {
						plugins: [["@swc/react-compiler", {}]],
					},
				},
			},
		} as ReactPluginOptions),
		devServer({
			entry: "src/hono-entry.ts",
			exclude: [
				/^\/@.+$/,
				/.*\.(ts|tsx|vue)($|\?)/,
				/.*\.(s?css|less)($|\?)/,
				/^\/favicon\.ico$/,
				/.*\.(svg|png)($|\?)/,
				/^\/(public|assets|static)\/.+/,
				/^\/node_modules\/.*/,
			],
			injectClientScript: false,
		}),
		// vite-plugin-mcp: Experimental plugin for AI-assisted development
		// Provides MCP endpoint exposing Vite app structure to AI tools (Cursor, etc.)
		// Dev-only (enabled via command === 'serve'), not included in production builds
		// See VITE_PLUGIN_MCP_ANALYSIS.md for details
		...(command === "serve"
			? [
					ViteMcp({
						//updateCursorMcpJson: false, // Manual config to avoid overwriting existing MCP servers
						printUrl: true,
					}),
				]
			: []),
	],
	server: {
		port: 3000,
	},
	build: {
		...sharedViteConfig.build,
		sourcemap: true,
		ssr: true,
		outDir: "dist",
		rollupOptions: {
			...sharedViteConfig.build?.rollupOptions,
			input: "src/hono-entry.ts",
			output: {
				entryFileNames: "[name].js",
			},
			external: [
				...((sharedViteConfig.build?.rollupOptions?.external as string[]) ||
					[]),
				"@reveal-config",
			],
		},
	},
}));
