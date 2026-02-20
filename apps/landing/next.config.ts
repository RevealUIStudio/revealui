import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: '.next',
  // Required for Vercel serverless deployment
  output: 'standalone',
  // Configure Turbopack for monorepo workspace resolution
  turbopack: {
    root: path.join(__dirname, '../..'),
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
  // Transpile workspace packages so Next.js can resolve them in Vercel builds
  // Includes direct deps (@revealui/core, @revealui/db) and their transitive workspace deps
  transpilePackages: [
    '@revealui/config',
    '@revealui/contracts',
    '@revealui/core',
    '@revealui/db',
    '@revealui/utils',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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

export default nextConfig
