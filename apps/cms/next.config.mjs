/** @type {import('next').NextConfig} */

import {withPayload} from "@payloadcms/next/withPayload"
import path from "node:path"
import process from "node:process"
import {fileURLToPath} from "node:url"
import ContentSecurityPolicy from "./csp.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Conditionally import Sentry wrapper if DSN is configured
let withSentryConfig = (config) => config
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    const sentryModule = await import("@sentry/nextjs")
    withSentryConfig = sentryModule.withSentryConfig || ((config) => config)
  } catch {
    // Sentry not installed, use no-op wrapper
  }
}

const nextConfig = {
  reactStrictMode: true,
  distDir: ".next",
  // Disable Turbopack - using webpack for better path alias resolution
  // Set empty turbopack config to silence Next.js 16 warning
  turbopack: {},
  // Resolve path aliases for build (both server and client)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "./src"),
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "www.gravatar.com",
      },
      ...[process.env.NEXT_PUBLIC_SERVER_URL]
        .filter(Boolean)
        .map((item) => {
          try {
            const url = new URL(item)
            return {
              hostname: url.hostname,
              protocol: url.protocol.replace(":", ""),
            }
          } catch (error) {
            console.error("Invalid URL in NEXT_PUBLIC_SERVER_URL:", item)
            return null
          }
        })
        .filter(Boolean),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: ContentSecurityPolicy,
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
        ],
      },
    ]
  },
}

// Conditionally wrap with Sentry if DSN is configured
let config = withPayload(nextConfig)

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    // Dynamic import for Sentry (will be available after package installation)
    const sentryModule = await import("@sentry/nextjs")
    const { withSentryConfig } = sentryModule
    config = withSentryConfig(config, {
      silent: true,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    })
  } catch {
    // Sentry not installed yet, use config as-is
  }
}

export default config
