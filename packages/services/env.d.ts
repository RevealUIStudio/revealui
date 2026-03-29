/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATABASE_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_PUBLIC_URL: string;
  readonly VITE_PUBLIC_VERCEL_URL: string;
  readonly REVEALUI_PUBLIC_SERVER_URL: string;
  readonly NODE_ENV: string;
  readonly DATABASE_URL: string;
  readonly NEXT_PUBLIC_SERVER_URL: string;
  readonly API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'process' {
  interface Env extends ImportMetaEnv {}
}
