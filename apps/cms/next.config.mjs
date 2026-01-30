import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import sentryModule from '@sentry/nextjs'

// RevealUI Next.js integration
import { withRevealUI } from '@revealui/core/nextjs'
import ContentSecurityPolicy from './csp.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: '.next',
  // Use standalone output to avoid SSG database connections during build
  output: 'standalone',
  // Configure Turbopack for monorepo support
  // This is critical for resolving workspace packages outside the project root
  turbopack: {
    root: path.join(__dirname, '../..'), // Point to monorepo root
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
  // Externalize problematic packages in server bundle
  serverExternalPackages: ['libsql', '@libsql/client', '@libsql/client-wasm'],
  // Transpile workspace packages - all now use bundler module resolution with extensionless imports
  // This works with Turbopack since we changed from NodeNext to bundler resolution
  transpilePackages: [
    '@revealui/config',
    '@revealui/db',
    '@revealui/contracts',
    '@revealui/auth',
    '@revealui/core',
    '@revealui/ai',
    '@revealui/sync',
    'services',
  ],
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
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
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
  }
}

export default config
