/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATABASE_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY: string;
  readonly VITE_PUBLIC_URL: string;
  readonly VITE_PUBLIC_VERCEL_URL: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_SECRET_KEY: string;
  readonly VITE_STRIPE_WEBHOOK_SECRET: string;
  readonly PAYLOAD_PUBLIC_SERVER_URL: string;
  readonly NODE_ENV: string;
  readonly WHITELISTORIGINS: string;
  readonly DATABASE_URI: string;
  readonly PAYLOAD_SECRET: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly YOUTUBE_API_KEY: string;
  readonly YOUTUBE_BASE_URL: string;
  readonly API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "process" {
  interface Env extends ImportMetaEnv {}
}
