/**
 * Babel configuration for React Compiler
 * Enables compile-time optimizations for React components
 *
 * Note: This config is used by @vitejs/plugin-react when configured
 * with the babel option. The React Compiler plugin is configured
 * directly in vite.config.ts for better integration.
 *
 * See: https://react.dev/learn/react-compiler
 */

export default {
	plugins: [
		[
			"babel-plugin-react-compiler",
			{
				// React Compiler options
				// See: https://react.dev/learn/react-compiler
			},
		],
	],
};
