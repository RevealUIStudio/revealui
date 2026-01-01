/**
 * Next.js configuration wrapper for RevealUI
 * Provides webpack aliases, environment variables, and build configuration
 */
function withRevealUI(nextConfig = {}, options = {}) {
  const {
    configPath = './revealui.config.ts',
    admin = true,
    adminRoute = '/admin',
    apiRoute = '/api',
  } = options

  return {
    ...nextConfig,

    // Environment variables for RevealUI
    env: {
      ...nextConfig.env,
      REVEALUI_CONFIG_PATH: configPath,
      REVEALUI_ADMIN_ENABLED: admin.toString(),
      REVEALUI_ADMIN_ROUTE: adminRoute,
      REVEALUI_API_ROUTE: apiRoute,
    },

    // Webpack configuration
    webpack: (config, context) => {
      const { isServer, dev } = context

      // Apply any existing webpack config first
      if (nextConfig.webpack) {
        config = nextConfig.webpack(config, context)
      }

      // Add RevealUI-specific webpack aliases
      config.resolve = config.resolve || {}
      config.resolve.alias = {
        ...config.resolve.alias,
        // RevealUI core aliases - use direct paths
        '@revealui/core': require('path').resolve(__dirname, '../../index'),
        '@revealui/cms': require('path').resolve(__dirname, '../index'),
        '@revealui/config': configPath,
      }

      // Note: Environment variables are passed via next.config env option above
      // No need for DefinePlugin - Next.js handles this automatically

      return config
    },

    // Headers for RevealUI
    async headers() {
      const existingHeaders = nextConfig.headers ? await nextConfig.headers() : []

      return [
        ...existingHeaders,
        // RevealUI admin headers
        ...(admin ? [{
          source: `${adminRoute}/:path*`,
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'SAMEORIGIN',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
          ],
        }] : []),
      ]
    },

    // Images configuration for RevealUI
    images: {
      ...nextConfig.images,
      // Add RevealUI-specific image domains if needed
      remotePatterns: [
        ...(nextConfig.images?.remotePatterns || []),
        // Add any RevealUI-specific image domains here
      ],
    },
  }
}

module.exports = { withRevealUI }
