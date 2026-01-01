import type { NextConfig } from 'next'

export interface WithRevealUIOptions {
  /** Path to the RevealUI config file */
  configPath?: string
  /** Whether to enable admin UI */
  admin?: boolean
  /** Admin route path */
  adminRoute?: string
  /** API route path */
  apiRoute?: string
}

/**
 * Next.js configuration wrapper for RevealUI
 * Provides webpack aliases, environment variables, and build configuration
 */
export function withRevealUI(
  nextConfig: NextConfig = {},
  options: WithRevealUIOptions = {}
): NextConfig {
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
        // RevealUI core aliases - use relative paths to avoid import issues
        '@revealui/core': require.resolve('../../index'),
        '@revealui/cms': require.resolve('../index'),
        '@revealui/config': configPath,
      }

      // Add environment variables for client-side
      if (!isServer) {
        config.plugins = config.plugins || []

        // Add DefinePlugin for client-side environment variables
        const webpack = require('webpack')
        config.plugins.push(
          new webpack.DefinePlugin({
            'process.env.REVEALUI_ADMIN_ROUTE': JSON.stringify(adminRoute),
            'process.env.REVEALUI_API_ROUTE': JSON.stringify(apiRoute),
          })
        )
      }

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
