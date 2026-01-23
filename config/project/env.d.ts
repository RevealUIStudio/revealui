/// <reference types="vite/client" />

/**
 * Environment variable types for Vite (client-side).
 * Variables with VITE_ prefix are exposed to the client.
 */
interface ImportMetaEnv {
  // Client-exposed variables (VITE_ prefix required)
  readonly VITE_DATABASE_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY?: string
  readonly VITE_PUBLIC_URL?: string
  readonly VITE_PUBLIC_VERCEL_URL?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_STRIPE_SECRET_KEY?: string
  readonly VITE_STRIPE_WEBHOOK_SECRET?: string

  // Server-only variables (no VITE_ prefix, not exposed to client)
  readonly REVEALUI_PUBLIC_SERVER_URL?: string
  readonly NODE_ENV?: 'development' | 'production' | 'test'
  readonly DATABASE_URL?: string
  readonly REVEALUI_SECRET?: string
  readonly SUPABASE_ANON_KEY?: string
  readonly API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Extend Node.js ProcessEnv with environment variables.
 * Note: process.env is available server-side only.
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv extends ImportMetaEnv {}
  }
}

export {}
