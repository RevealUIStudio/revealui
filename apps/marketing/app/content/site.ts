// Site-wide constants: URLs, contact, social, repo links, brand strings, METRICS.
// Sourced from extraction of inline JSX content in:
//   app/components/Footer.tsx, app/components/GetStarted.tsx,
//   app/components/landing/Hero.tsx, app/routes/*.tsx
// Per the internal marketing-overhaul plan §4.4 (Phase 1).
// Phase 1b additions: repoRoadmap, apiDocs.
// Phase 1c additions: adminLogin, x, linkedin, forum, repoChangelog, repoLicense.
// Phase 3 addition: METRICS export — canonical numbers from docs/MARKETING_METRICS.md §1
//   (validated by `pnpm tsx scripts/validate/claim-drift.ts`). All content/* files
//   that reference a count import METRICS rather than hardcoding the integer.
//   When the underlying code changes (new package, new MCP server, etc.):
//     1. Update docs/MARKETING_METRICS.md §1
//     2. Update METRICS below to match
//     3. Run claim-drift validator to confirm
//     4. marketing content automatically reflects the new number — no copy edit needed

/**
 * Canonical marketing metrics — pinned-truth, sourced from
 * docs/MARKETING_METRICS.md §1. Do NOT hardcode these integers anywhere
 * else in apps/marketing/app/content/*.
 */
export const METRICS = {
  /** Packages in `packages/` directories. Source: claim-drift countPackages. */
  packages: 27,
  /** Apps in `apps/`. Source: claim-drift countApps. */
  apps: 4,
  /** Workspaces (packages + apps). Source: claim-drift countWorkspaces. */
  workspaces: 31,
  /** Test files across the monorepo. Source: claim-drift countTestFiles. */
  testFiles: 984,
  /** UI components in `packages/presentation/`. Source: claim-drift countUIComponents. */
  uiComponents: 60,
  /**
   * MCP servers in `packages/mcp/src/servers/*.ts` (excluding underscore-prefixed
   * utilities). Includes `adapter.ts` (BaseAdapter + Vercel/Stripe/Neon concrete
   * adapter subclasses). Source: claim-drift countMCPServers.
   */
  mcpServers: 14,
  /** Drizzle pgTable declarations across packages/db/src/schema/. Source: claim-drift countDbTables. */
  dbTables: 85,
  /** License split. Source: claim-drift licenseSplit. */
  licenseSplit: {
    /** MIT-licensed packages. */
    mit: 21,
    /** Fair Source (FSL-1.1-MIT) packages — @revealui/ai, engines, harnesses, mcp, services. */
    fsl: 5,
    /** Internal/none — `test` workspace package (private, no public license). */
    internal: 1,
  },
} as const;

export type Metrics = typeof METRICS;

export const SITE = {
  brand: 'RevealUI',
  brandTagline: 'The open runtime for businesses that run their own AI.',
  urls: {
    signup: 'https://admin.revealui.com/signup',
    admin: 'https://admin.revealui.com',
    docs: 'https://docs.revealui.com',
    docsMcp: 'https://docs.revealui.com/mcp',
    repo: 'https://github.com/RevealUIStudio/revealui',
    repoRoadmap: 'https://github.com/RevealUIStudio/revealui/blob/main/docs/ROADMAP.md',
    repoDiscussions: 'https://github.com/RevealUIStudio/revealui/discussions',
    repoIssues: 'https://github.com/RevealUIStudio/revealui/issues',
    sponsors: 'https://github.com/sponsors/RevealUIStudio',
    agency: 'https://revealuistudio.com',
    api: 'https://api.revealui.com',
    apiAgent: 'https://api.revealui.com/.well-known/agent.json',
    apiOpenapi: 'https://api.revealui.com/openapi.json',
    apiDocs: 'https://docs.revealui.com/api',
    fslSoftware: 'https://fsl.software/',
    fslSpecText: 'https://fsl.software/FSL-1.1-MIT.template.md',
    adminLogin: 'https://admin.revealui.com/login',
    x: 'https://x.com/revealui',
    linkedin: 'https://www.linkedin.com/company/revealui',
    forum: 'https://github.com/RevealUIStudio/revealui/discussions',
    repoChangelog: 'https://github.com/RevealUIStudio/revealui/blob/main/CHANGELOG.md',
    repoLicense: 'https://github.com/RevealUIStudio/revealui/blob/main/LICENSE',
  },
  emails: {
    support: 'support@revealui.com',
    founder: 'founder@revealui.com',
    security: 'security@revealui.com',
  },
  cli: {
    create: 'npx create-revealui@latest my-app',
  },
} as const;

export type SiteConfig = typeof SITE;
