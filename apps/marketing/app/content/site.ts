// Site-wide constants: URLs, contact, social, repo links, brand strings.
// Sourced from extraction of inline JSX content in:
//   app/components/Footer.tsx, app/components/GetStarted.tsx,
//   app/components/landing/Hero.tsx, app/routes/*.tsx
// Per docs/lanes/marketing-overhaul/plan.md §4.4 (Phase 1).

export const SITE = {
  brand: 'RevealUI',
  brandTagline: 'The open runtime for AI-native businesses.',
  urls: {
    signup: 'https://admin.revealui.com/signup',
    admin: 'https://admin.revealui.com',
    docs: 'https://docs.revealui.com',
    docsMcp: 'https://docs.revealui.com/mcp',
    repo: 'https://github.com/RevealUIStudio/revealui',
    repoDiscussions: 'https://github.com/RevealUIStudio/revealui/discussions',
    repoIssues: 'https://github.com/RevealUIStudio/revealui/issues',
    sponsors: 'https://github.com/sponsors/RevealUIStudio',
    agency: 'https://revealuistudio.com',
    api: 'https://api.revealui.com',
    apiAgent: 'https://api.revealui.com/.well-known/agent.json',
    apiOpenapi: 'https://api.revealui.com/openapi.json',
    fslSoftware: 'https://fsl.software/',
    fslSpecText: 'https://fsl.software/FSL-1.1-MIT.template.md',
  },
  emails: {
    support: 'support@revealui.com',
    founder: 'founder@revealui.com',
  },
  cli: {
    create: 'npx create-revealui@latest my-app',
  },
} as const;

export type SiteConfig = typeof SITE;
