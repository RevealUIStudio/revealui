// Site-wide constants: URLs, contact, social, repo links, brand strings, METRICS.
// Sourced from extraction of inline JSX content in:
//   app/components/Footer.tsx, app/components/GetStarted.tsx,
//   app/components/landing/Hero.tsx, app/routes/*.tsx
// Per the internal marketing-overhaul plan §4.4 (Phase 1).
// Phase 1b additions: repoRoadmap, apiDocs.
// Phase 1c additions: adminLogin, x, linkedin, forum, repoChangelog, repoLicense.
// Phase 3 addition: METRICS export, canonical numbers from docs/MARKETING_METRICS.md §1
//   (validated by `pnpm tsx scripts/validate/claim-drift.ts`). All content/* files
//   that reference a count import METRICS rather than hardcoding the integer.
//   When the underlying code changes (new package, new MCP server, etc.):
//     1. Update docs/MARKETING_METRICS.md §1
//     2. Update METRICS below to match
//     3. Run claim-drift validator to confirm
//     4. marketing content automatically reflects the new number; no copy edit needed

/**
 * Canonical marketing metrics: pinned-truth, sourced from
 * docs/MARKETING_METRICS.md §1. Do NOT hardcode these integers anywhere
 * else in apps/marketing/app/content/*.
 */
export const METRICS = {
  /** Packages in `packages/` directories. Source: claim-drift countPackages. */
  packages: 32,
  /** Apps in `apps/`. Source: claim-drift countApps. */
  apps: 6,
  /** Workspaces (packages + apps). Source: claim-drift countWorkspaces. */
  workspaces: 38,
  /** Test files across the monorepo. Source: claim-drift countTestFiles. */
  testFiles: 1162,
  /** UI components in `packages/presentation/`. Source: claim-drift countUIComponents. */
  uiComponents: 65,
  /**
   * MCP servers in `packages/mcp/src/servers/*.ts` (excluding underscore-prefixed
   * utilities). Includes `adapter.ts` (BaseAdapter + Vercel/Stripe/Neon concrete
   * adapter subclasses). Source: claim-drift countMCPServers.
   */
  mcpServers: 13,
  /** Drizzle pgTable declarations across packages/db/src/schema/. Source: claim-drift countDbTables. */
  dbTables: 104,
  /** License split. Source: claim-drift licenseSplit. */
  licenseSplit: {
    /** MIT-licensed packages. */
    mit: 25,
    /** Fair Source (FSL-1.1-MIT) packages: @revealui/ai, engines, harnesses, mcp, services. */
    fsl: 5,
    /** Internal/none: `scripts` and `apify-actor-governed-run` (private, no public license). */
    internal: 2,
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
    agency: 'https://revealuistudio.com',
    api: 'https://api.revealui.com',
    apiAgent: 'https://api.revealui.com/.well-known/agent.json',
    apiOpenapi: 'https://api.revealui.com/openapi.json',
    apiDocs: 'https://docs.revealui.com/api',
    fslSoftware: 'https://fsl.software/',
    fslSpecText: 'https://fsl.software/FSL-1.1-MIT.template.md',
    adminLogin: 'https://admin.revealui.com/login',
    /**
     * X/Twitter handle is not live yet (x.com/revealui 404 as of 2026-08 audit).
     * Omit from public nav until the account exists; do not reintroduce a dead href.
     */
    linkedin: 'https://www.linkedin.com/company/revealui',
    repoChangelog: 'https://github.com/RevealUIStudio/revealui/blob/main/CHANGELOG.md',
    repoLicense: 'https://github.com/RevealUIStudio/revealui/blob/main/LICENSE',
    /**
     * GAP-434 Starter Kit Stripe Payment Link (live). Owner re-ruled 2026-08-02
     * to Stripe Payment Link (C) over Polar; Managed Payments (D) is a later upgrade.
     * Stripe product prod_V01FoZi9YbgZw9 / price_1U01D1Jz64n6uEibtamJHxkU.
     */
    starterKitCheckout: 'https://buy.stripe.com/dRmeVegcH1AM2mmdbsa3u03',
    /**
     * Public shipping board (Projects tab). Prefer a concrete Projects v2 URL when
     * one is pinned; until then the org/repo projects index is the honest link.
     */
    repoProjects: 'https://github.com/RevealUIStudio/revealui/projects',
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

/**
 * Community defaults (owner 2026-08-10; Skool URL 2026-08-11). Full map:
 * fleet private `business/community-map-2026-08-10.md` + offerings-canonical Track E.
 *
 * Consumers must not render a nav/footer link when `url` is null, and must not
 * treat Skool as a public join CTA while `skool.access === 'invite-only'`.
 *
 * - Skool: invite-only after purchase (profile URL is for owner fulfillment / invites)
 * - Substack: public subscribe (https://substack.com/@revealuistudio); broadcast list, not paid support home
 * - Discussions / Projects: public (urls live under SITE.urls)
 */
export const COMMUNITY = {
  discussions: {
    access: 'public' as const,
    url: SITE.urls.repoDiscussions,
  },
  projects: {
    access: 'public-view' as const,
    url: SITE.urls.repoProjects,
  },
  /**
   * Paid buyer home. Invite after Starter Kit / SaaS / AR close.
   * Profile URL set 2026-08-11 (owner). Still invite-only: do not put a free
   * "Join Skool" CTA on marketing while access is invite-only.
   */
  skool: {
    access: 'invite-only' as const,
    url: 'https://www.skool.com/@joshua-vaughn-3634',
  },
  /**
   * Broadcast + free list. Not the paid support desk.
   * Public subscribe URL set 2026-08-11 (owner). Safe for footer/nav when non-null.
   */
  substack: {
    access: 'public-subscribe' as const,
    url: 'https://substack.com/@revealuistudio',
  },
} as const;

export type SiteConfig = typeof SITE;
export type CommunityConfig = typeof COMMUNITY;
