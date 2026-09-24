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
  /**
   * Sentry environment label for the marketing client. Not a secret.
   * Set `VITE_SENTRY_ENVIRONMENT=staging` (or `SENTRY_ENVIRONMENT=staging`,
   * copied in vite.config.ts) on the staging marketing project.
   */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /**
   * Studio-hosted Umami origin (no trailing path). Absent in dev and in prod
   * until set on the Vercel project; the tracker stays dormant without it.
   */
  readonly VITE_UMAMI_URL?: string;
  /**
   * Public Umami website id for revealui.com. Not a secret — client-visible
   * by design. The sink stays dormant when this or `VITE_UMAMI_URL` is absent.
   */
  readonly VITE_UMAMI_WEBSITE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
