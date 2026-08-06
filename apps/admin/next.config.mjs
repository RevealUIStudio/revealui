import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import sentryModule from '@sentry/nextjs'

// RevealUI Next.js integration
// Import directly from the withRevealUI subpath, not '@revealui/core/nextjs'.
// The runtime barrel intentionally omits it so `node:fs` doesn't get traced
// into route bundles via NFT.
import { withRevealUI } from '@revealui/core/nextjs/withRevealUI'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Monorepo product version for dashboard chrome (not apps/admin's private 0.1.0 stub).
// NEXT_PUBLIC_ so client sidebar/footer can read it; inlined at build time.
function readMonorepoVersion() {
  try {
    const raw = readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
    const pkg = JSON.parse(raw)
    return typeof pkg.version === 'string' && pkg.version.length > 0 ? pkg.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}
const monorepoVersion = readMonorepoVersion()

// Pro package (@revealui/ai) is Fair Source (FSL-1.1-MIT) and normally present.
// If someone removes it from a fork, alias all subpaths to a stub for graceful degradation.
const hasProAI = existsSync(path.join(__dirname, '../../packages/ai/package.json'))
const proAIStub = './src/lib/ai/pro-stub.ts'
const proAIAliases = hasProAI ? {} : {
  '@revealui/ai': proAIStub,
  '@revealui/ai/embeddings': proAIStub,
  '@revealui/ai/llm/server': proAIStub,
  '@revealui/ai/llm/client': proAIStub,
  '@revealui/ai/llm/key-validator': proAIStub,
  '@revealui/ai/llm/providers/base': proAIStub,
  '@revealui/ai/memory': proAIStub,
  '@revealui/ai/memory/vector': proAIStub,
  '@revealui/ai/memory/persistence': proAIStub,
  '@revealui/ai/memory/stores': proAIStub,
  '@revealui/ai/memory/agent': proAIStub,
  '@revealui/ai/memory/services': proAIStub,
  '@revealui/ai/tools/cms': proAIStub,
  '@revealui/ai/tools/registry': proAIStub,
  '@revealui/ai/tools/coding': proAIStub,
  '@revealui/ai/ingestion': proAIStub,
  '@revealui/ai/client': proAIStub,
  '@revealui/ai/skills': proAIStub,
  '@revealui/ai/orchestration/streaming-runtime': proAIStub,
  '@revealui/ai/orchestration/agent': proAIStub,
  '@revealui/ai/inference': proAIStub,
  '@revealui/ai/inference/context-budget': proAIStub,
  '@revealui/ai/inference/tool-result-compressor': proAIStub,
  '@revealui/ai/inference/task-decomposer': proAIStub,
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: '.next',
  env: {
    NEXT_PUBLIC_APP_VERSION: monorepoVersion,
    APP_VERSION: monorepoVersion,
  },
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
      ...proAIAliases,
    },
  },
  // Webpack configuration for non-Turbopack builds
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@reveal-config': path.resolve(__dirname, 'revealui.config.ts'),
    }
    // Alias Pro AI subpaths to stub when package is absent (CI/OSS builds)
    if (!hasProAI) {
      const stubPath = path.resolve(__dirname, proAIStub)
      for (const key of Object.keys(proAIAliases)) {
        config.resolve.alias[key] = stubPath
      }
    }
    return config
  },
  // Externalize problematic packages in server bundle
  // Pro packages (@revealui/ai) and service packages are optional peer dependencies.
  // Mark them as server-external so the bundler skips them at build time;
  // route handlers load them via dynamic import() with a try/catch fallback.
  serverExternalPackages: [
    'libsql',
    '@libsql/client',
    '@libsql/client-wasm',
    '@revealui/ai',
    '@revealui/services',
    // @simplewebauthn/server (+ its @peculiar/asn1-* / cbor deps) is ESM- and
    // crypto-heavy and breaks at runtime when bundled into the standalone server
    // output — fine in `next dev`, throws in the prod build. It reaches the bundle
    // via @revealui/auth (transpilePackages). Externalize so it loads from
    // node_modules at runtime. Fixes the prod passkey-options 500 (GAP-220).
    '@simplewebauthn/server',
    // @revealui/config exports a lazy-Proxy default (read as config.reveal.secret
    // etc.). When transpiled by Turbopack into the standalone server bundle the
    // Proxy default export is mangled, so config.reveal resolves to `undefined`
    // at runtime — fine in `next dev`, but throws "Cannot read properties of
    // undefined (reading 'secret')" in the prod build, 500ing passkey + every
    // config.reveal route. It ships built ESM dist (./dist/index.js), so
    // externalize it to load the working Proxy from node_modules un-transformed.
    '@revealui/config',
  ],
  // Transpile workspace packages - all now use bundler module resolution with extensionless imports
  // This works with Turbopack since we changed from NodeNext to bundler resolution
  transpilePackages: [
    '@revealui/db',
    '@revealui/contracts',
    '@revealui/auth',
    '@revealui/core',
    '@revealui/editor',
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
        hostname: 'www.gravatar.com',
      },
      // Cloudflare R2 public bucket — the canonical (and sole) object-storage
      // backend for media originals (GAP-208); next/image resizes on demand.
      // The retired Vercel Blob + never-canonical Cloudinary entries were
      // removed with the R2 cutover.
      ...[process.env.R2_PUBLIC_BASE_URL?.trim(), process.env.NEXT_PUBLIC_SERVER_URL?.trim()]
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
  async rewrites() {
    // The admin Run / Watch-live UI POSTs same-origin to /api/agent-stream and
    // /api/agent-stream/elicit, but those handlers live on the API host, not
    // the admin app, so the calls 404 without a proxy. Rewrite them to the API
    // host so the request stays same-origin (the CSRF/cookie/CORS posture is
    // untouched) and the SSE stream is proxied through.
    //
    // The destination is NEXT_PUBLIC_API_URL (the API host, e.g.
    // https://api.revealui.com), NOT NEXT_PUBLIC_SERVER_URL: fleet-wide,
    // SERVER_URL means the admin app's OWN origin (proxy.ts, the license
    // domain binding, and the revvault sync manifests all bind it that way),
    // so pointing the rewrite at it made the proxy rewrite to itself and
    // every hosted call died with a 508 rewrite loop. When NEXT_PUBLIC_API_URL
    // is unset (single-origin dev), no rewrite is added.
    let apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return []
    while (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1)
    // Self-origin guard: if the configured API host IS this admin origin, a
    // rewrite would loop (the 508 failure mode above). Fail loud and skip.
    let selfUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim() ?? ''
    while (selfUrl.endsWith('/')) selfUrl = selfUrl.slice(0, -1)
    if (selfUrl && apiUrl === selfUrl) {
      console.error(
        `agent-stream rewrite disabled: NEXT_PUBLIC_API_URL (${apiUrl}) equals the admin origin; a rewrite would loop (508). Point NEXT_PUBLIC_API_URL at the API host.`,
      )
      return []
    }
    return [
      {
        source: '/api/agent-stream',
        destination: `${apiUrl}/api/agent-stream`,
      },
      {
        source: '/api/agent-stream/:path*',
        destination: `${apiUrl}/api/agent-stream/:path*`,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        // Content-Security-Policy is set per-request (with a nonce) in
        // src/proxy.ts — a static next.config header cannot carry a per-request
        // nonce, so the proxy is the single CSP source. The other security
        // headers below stay here (they need no nonce).
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
