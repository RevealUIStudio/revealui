// @ts-check
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  async redirects() {
    return [
      {
        source: '/docs',
        destination: 'https://docs.revealui.com',
        permanent: true,
      },
      {
        source: '/docs/:path*',
        destination: 'https://docs.revealui.com/:path*',
        permanent: true,
      },
      {
        source: '/pro',
        destination: '/pricing',
        permanent: false,
      },
      {
        source: '/community',
        destination: 'https://revnation.discourse.group',
        permanent: false,
      },
    ]
  },
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
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.revealui.com https://vitals.vercel-insights.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig
