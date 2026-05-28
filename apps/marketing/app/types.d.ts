/// <reference types="vite/client" />

// Side-effect font imports have no runtime API; declare them so TS doesn't
// complain about missing type declarations.
declare module '@fontsource-variable/inter';
declare module '@fontsource-variable/inter-tight';
declare module '@fontsource-variable/jetbrains-mono';

interface ImportMetaEnv {
  /**
   * Sentry DSN for the marketing client. Absent in dev (and in prod before the
   * owner pastes a real DSN into Vercel env); the SDK init is a no-op when
   * missing so the build stays clean.
   */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
