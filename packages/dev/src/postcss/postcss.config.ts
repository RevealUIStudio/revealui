/**
 * Shared PostCSS Configuration for RevealUI Framework
 *
 * This config provides PostCSS plugins for Tailwind CSS processing.
 * Used by apps and packages that need Tailwind CSS compilation.
 *
 * @example
 * ```ts
 * import postcssConfig from 'dev/postcss'
 *
 * export default postcssConfig
 * ```
 *
 * @type {import('postcss-load-config').Config}
 */
const postcssConfig = {
	plugins: {
		"postcss-import": {
			path: ["src"],
		},
		"@tailwindcss/postcss": {},
		autoprefixer: {},
	},
};

export default postcssConfig;
