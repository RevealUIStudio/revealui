import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import sentryModule from '@sentry/nextjs'

// RevealUI Next.js integration
import { withRevealUI } from '@revealui/core/nextjs'
import ContentSecurityPolicy from './csp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: '.next',
  // Use standalone output for all environments including Vercel
  // Required for monorepo workspace packages to resolve correctly in serverless
  output: 'standalone',
  // Configure Turbopack for monorepo support
  // This is critical for resolving workspace packages outside the project root
  turbopack: {
    root: path.join(__dirname, '../..'), // Point to monorepo root
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
    resolveAlias: {
      '@reveal-config': './revealui.config.ts',
    },
  },
  // Webpack configuration for non-Turbopack builds
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@reveal-config': path.resolve(__dirname, 'revealui.config.ts'),
    }
    return config
  },
  // Externalize problematic packages in server bundle
  // Pro packages (@revealui/ai, @revealui/services) are optional peer dependencies.
  // Mark them as server-external so the bundler skips them at build time;
  // route handlers load them via dynamic import() with a try/catch fallback.
  serverExternalPackages: [
    'libsql',
    '@libsql/client',
    '@libsql/client-wasm',
    '@revealui/ai',
    '@revealui/services',
  ],
  // Transpile workspace packages - all now use bundler module resolution with extensionless imports
  // This works with Turbopack since we changed from NodeNext to bundler resolution
  transpilePackages: [
    '@revealui/config',
    '@revealui/db',
    '@revealui/contracts',
    '@revealui/auth',
    '@revealui/core',
    '@revealui/presentation',
    '@revealui/sync',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        // Vercel Blob CDN — originals stored here, next/image resizes on demand
        hostname: '*.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'www.gravatar.com',
      },
      ...[process.env.NEXT_PUBLIC_SERVER_URL?.trim()]
        .filter(Boolean)
        .map((item) => {
          try {
            const url = new URL(item)
            return {
              hostname: url.hostname,
              protocol: url.protocol.replace(':', ''),
            }
          } catch (_error) {
            // Silently skip malformed URLs — validation happens at runtime
            return null
          }
        })
        .filter(Boolean),
    ],
  },
  async redirects() {
    return [
      {
        source: '/posts',
        destination: 'https://revealui.com/blog',
        permanent: true,
      },
    ]
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
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
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
