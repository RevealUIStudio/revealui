/**
 * RevealUI Framework Configuration
 *
 * This is the unified configuration file for the RevealUI monorepo.
 * It provides type-safe configuration for both the web (RevealUI) and CMS (Next.js) apps.
 *
 * Configuration merges with existing +config.ts files for gradual migration.
 *
 * @see https://reveal.dev/config
 */

// Note: These imports will work once the reveal package is built
// For development, TypeScript may show errors but runtime will resolve correctly
// @ts-expect-error - reveal package exports not yet available in monorepo root context
import { defineConfig } from "reveal/config";
// @ts-expect-error - reveal package exports not yet available in monorepo root context
import react from "reveal/plugins/react";
// @ts-expect-error - reveal package exports not yet available in monorepo root context
import vercel from "reveal/plugins/vercel";

export default defineConfig({
	/**
	 * Plugins configuration
	 * RevealUI plugins extend framework functionality
	 */
	plugins: [
		// React plugin for React 19 integration with RevealUI
		react({
			strictMode: true,
			useSwc: true,
		}),

		// Vercel plugin for deployment optimization and SSR
		vercel({
			smart: true,
		}),
	],

	/**
	 * RevealUI-specific configuration
	 * Applies to apps/web app
	 */
	revealui: {
		prerender: {
			partial: false,
			noExtraDir: false,
			parallel: 4,
			disableAutoRun: false,
		},
		trailingSlash: false,
		baseServer: "/",
		baseAssets: "/",
		disableUrlNormalization: false,
		redirects: {},
	},

	/**
	 * Next.js-specific configuration
	 * Applies to apps/cms app
	 */
	nextjs: {
		output: "standalone",
		experimental: {
			serverActions: true,
			serverComponentsExternalPackages: [
				"sharp",
				"react-animate-height",
			],
		},
	},

	/**
	 * RevealUI CMS configuration
	 */
	cms: {
		serverURL: process.env.REVEALUI_PUBLIC_SERVER_URL || "http://localhost:4000",
	},

	/**
	 * Environment-specific overrides
	 */
	env: {
		development: {
			revealui: {
				prerender: false, // Disable prerender in development
			},
			reveal: {
				prerender: false,
			},
		},
		production: {
			revealui: {
				prerender: {
					partial: false,
					parallel: 4,
					noExtraDir: false,
				},
			},
			reveal: {
				prerender: {
					partial: false,
					parallel: 4,
				},
			},
		},
		test: {
			revealui: {
				prerender: false,
			},
		},
	},

	/**
	 * Base Reveal configuration
	 * These settings apply globally across both apps
	 */
	reveal: {
		prerender: {
			partial: false,
			parallel: 4,
			noExtraDir: false,
			disableAutoRun: false,
		},
		disableAutoFullBuild: false,
		baseServer: "/",
		baseAssets: "/",
		trailingSlash: false,
		disableUrlNormalization: false,
		redirects: {},
		crawl: {
			git: false, // Disable git-based crawling by default
		},
		includeAssetsImportedByServer: true,
	},

	/**
	 * Vite configuration overrides
	 * Additional Vite settings can be specified here
	 */
	vite: {
		build: {
			sourcemap: true,
		},
		server: {
			port: 3000, // Web app dev server port
		},
	},
});
