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
  readonly REVEALUI_DRAFT_SECRET: string;
  readonly VITE_STRIPE_IS_TEST_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'process' {
  interface Env extends ImportMetaEnv {}
}

// Side-effect font imports have no runtime API; declare the @fontsource-variable
// CSS-only modules so TS doesn't complain. Self-hosted admin fonts imported in
// src/app/(frontend)/layout.tsx (GAP-324). Lives here because src/**/*.d.ts is
// gitignored (generated types); env.d.ts is the tracked, tsconfig-included d.ts.
declare module '@fontsource-variable/inter';
declare module '@fontsource-variable/inter-tight';
