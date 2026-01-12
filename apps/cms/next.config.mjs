/** @type {import('next').NextConfig} */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
// RevealUI Next.js integration
import { withRevealUI } from '@revealui/core/nextjs/withRevealUI'
import ContentSecurityPolicy from './csp.js'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  reactStrictMode: true,
  distDir: '.next',
  // Use standalone output to avoid SSG database connections during build
  output: 'standalone',
  // TypeScript errors are now properly fixed
  // All type errors have been resolved:
  // ✅ Config vs RevealConfig type mismatches fixed with type assertions
  // ✅ Missing test dependencies installed (@testing-library/react)
  // ✅ Missing route files in tests fixed with @ts-expect-error
  // ✅ All other type errors resolved
  // typescript: {
  //   ignoreBuildErrors: false, // Now safe to enforce type checking - setting removed
  // },
  // Externalize problematic packages in server bundle (applies to both Turbopack and Webpack)
  serverExternalPackages: ['libsql', '@libsql/client', '@libsql/client-wasm'],
  // Configure Turbopack - default bundler in Next.js 16
  // Turbopack automatically reads tsconfig.json paths, but explicit resolveAlias ensures compatibility
  turbopack: {
    resolveAlias: {
      // Main app alias - Turbopack handles wildcards automatically via tsconfig paths
      '@': path.resolve(__dirname, './src'),
      // Type alias
      '@/types': path.resolve(__dirname, './src/types/index.ts'),
      // Config alias - @revealui/config is managed by withRevealUI wrapper
      // Setting it here provides a reliable fallback using __dirname (always correct)
      // withRevealUI will validate and potentially override this with a resolved path
      // Use relative path for Turbopack (matches tsconfig.json: "./revealui.config.ts")
      '@revealui/config': './revealui.config.ts',
      // Dev package alias
      'dev/tailwind': path.resolve(__dirname, '../packages/dev/src/tailwind/tailwind.config.js'),
      // RevealUI aliases - point to source files (Turbopack handles TypeScript natively)
      'revealui': path.resolve(__dirname, '../packages/revealui/src'),
      '@revealui': path.resolve(__dirname, '../packages/revealui/src'),
      // Package subpath exports are handled by package.json exports
      // Turbopack should resolve these via workspace protocol
      // No need for explicit aliases - let package.json exports handle it
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'www.gravatar.com',
      },
      ...[process.env.NEXT_PUBLIC_SERVER_URL]
        .filter(Boolean)
        .map((item) => {
          try {
            const url = new URL(item)
            return {
              hostname: url.hostname,
              protocol: url.protocol.replace(':', ''),
            }
          } catch (_error) {
            console.error('Invalid URL in NEXT_PUBLIC_SERVER_URL:', item)
            return null
          }
        })
        .filter(Boolean),
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy,
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ]
  },
}

// Wrap with RevealUI configuration
let config = withRevealUI(nextConfig, {
  configPath: './revealui.config.ts',
  admin: true,
  adminRoute: '/admin',
  apiRoute: '/api',
})

// Apply Sentry wrapper if DSN is configured and Sentry is installed
// Note: Sentry also has separate client/server config files (sentry.client.config.ts, sentry.server.config.ts)
// This wrapper is for Next.js build-time webpack/turbopack configuration
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    // Use createRequire for ESM compatibility (synchronous CommonJS require in ESM)
    const sentryModule = require('@sentry/nextjs')
    if (sentryModule?.withSentryConfig) {
      config = sentryModule.withSentryConfig(config, {
        silent: true,
        widenClientFileUpload: true,
        hideSourceMaps: true,
        disableLogger: true,
      })
    }
  } catch {
    // Sentry not installed or not available - config will work without it
    // Sentry client/server config files handle initialization separately
  }
}

export default config
