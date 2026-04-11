/**
 * Shared PostCSS Configuration for RevealUI Framework
 *
 * This config provides PostCSS plugins for Tailwind CSS processing.
 * Used by apps and packages that need Tailwind CSS compilation.
 *
 * Tailwind CSS v4 handles imports and auto-prefixing natively via
 * @tailwindcss/postcss  -  no need for postcss-import or autoprefixer.
 *
 * @type {import('postcss-load-config').Config}
 */
const postcssConfig = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default postcssConfig;
