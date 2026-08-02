/**
 * Live static blog registry (GAP-467).
 * Single source for what ships on /blog and what claims-evidence must cover.
 * Body markdown lives under docs/blog/<file>; loaded only by blog-posts.ts.
 */

export interface BlogPostMeta {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly publishedAt: string;
  readonly author: string;
  /** Filename in docs/blog/ */
  readonly file: string;
}

export const BLOG_POST_METADATA: readonly BlogPostMeta[] = [
  {
    slug: 'open-runtime-for-fde-work',
    title: 'The open runtime for forward-deployed agent work',
    excerpt:
      'Demos die at the customer wall. Forward deployed work only finishes when the customer still owns the runtime after you leave.',
    publishedAt: '2026-07-29T18:00:00.000Z',
    author: 'Joshua Vaughn',
    file: '18-open-runtime-for-fde-work.md',
  },
  {
    slug: 'shareable-upside',
    title: 'I Built This So More People Could Own the Upside of AI',
    excerpt:
      'AI is splitting outcomes. I spent the longer path building a self-hosted runtime so more people could own the tools, not only rent them.',
    publishedAt: '2026-07-21T12:00:00.000Z',
    author: 'Joshua Vaughn',
    file: '17-shareable-upside.md',
  },
  {
    slug: 'ui-of-the-future',
    title: 'The UI of the Future Has Yet to Reveal Itself',
    excerpt:
      'The interface of the AI era is not a smarter chat window. It is your business itself, run by agents you own.',
    publishedAt: '2026-07-09T12:00:00.000Z',
    author: 'Joshua Vaughn',
    file: '16-ui-of-the-future.md',
  },
  {
    slug: 'revfleet-product-family',
    title: 'One Runtime, Eight Products: The RevFleet Family',
    excerpt:
      'You do not adopt a framework, you adopt a fleet. RevealUI is the flagship runtime, and seven sister products extend it, from an encrypted secret vault to an agent tool marketplace.',
    publishedAt: '2026-06-18T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '11-revfleet-product-family.md',
  },
  {
    slug: 'dashboard-agent-chat',
    title: 'Run Your Admin by Talking to It',
    excerpt:
      'Open the admin, type what you want done, and watch the agent do it, with streaming output and full tool visibility.',
    publishedAt: '2026-06-17T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '15-dashboard-agent-chat.md',
  },
  {
    slug: 'own-your-secrets',
    title: "Your Secrets Don't Belong in a .env File",
    excerpt:
      'The default bargain puts your credentials in a vendor dashboard or a plaintext .env file. RevVault keeps them age-encrypted on hardware you control, never as plaintext on disk.',
    publishedAt: '2026-06-16T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '12-own-your-secrets.md',
  },
  {
    slug: 'zero-regex',
    title: 'Building a Codebase With Zero Hand-Written Regex',
    excerpt:
      'We banned hand-written regular expressions across the entire fleet. Here is what we use instead, and why it makes the code safer and easier to read.',
    publishedAt: '2026-06-15T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '13-zero-regex.md',
  },
  {
    slug: 'claim-drift',
    title: 'The Marketing Site That Fails CI When It Lies',
    excerpt:
      'Every number on revealui.com is checked against the code on every push. When a stat drifts from reality, the build breaks before the lie ships.',
    publishedAt: '2026-06-14T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '14-claim-drift.md',
  },
  {
    slug: 'component-library',
    title: '65 Components, One Dependency',
    excerpt:
      'A native React component library with 65 components and a single runtime dependency. No Radix, no MUI, no lock-in, just components you own.',
    publishedAt: '2026-06-08T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '09-component-library.md',
  },
  {
    slug: 'own-your-data',
    title: 'Your Database, Your Storage, Your Sync',
    excerpt:
      'Standard Postgres, S3-compatible storage, and real-time sync, all built in and all portable. The data layer you can actually leave.',
    publishedAt: '2026-06-07T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '10-own-your-data.md',
  },
  {
    slug: 'getting-started',
    title: 'From Zero to Production in About 30 Minutes',
    excerpt:
      'Build a complete business application with auth, content, and payments: from zero to deployed in about 30 minutes.',
    publishedAt: '2026-03-27T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '08-getting-started.md',
  },
  {
    slug: 'agent-first-future',
    title: 'Building for the Agent-First Internet',
    excerpt:
      'The web was built for browsers. The next web is being built for agents. How RevealUI is designed for both.',
    publishedAt: '2026-03-26T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '07-agent-first-future.md',
  },
  {
    slug: 'open-source-and-pro',
    title: 'Open Source + Pro: How We Think About Monetization',
    excerpt:
      'What is free, what is paid, and why. A transparent breakdown of the RevealUI business model.',
    publishedAt: '2026-03-25T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '06-open-source-and-pro.md',
  },
  {
    slug: 'five-primitives',
    title: 'The Five Primitives of Business Software',
    excerpt:
      'A deep technical walkthrough of People, Content, Offers, Payments, and Agents: the building blocks every software company needs.',
    publishedAt: '2026-03-24T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '05-five-primitives.md',
  },
  {
    slug: 'local-first-ai-stack',
    title: 'The Air-Gap-Capable Business Runtime',
    excerpt:
      'Your secrets in your own vault, your AI running locally, your dev environment reproducible from a single command.',
    publishedAt: '2026-03-23T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '04-local-first-ai-stack.md',
  },
  {
    slug: 'multi-agent-coordination',
    title: 'Three AI Agents, One Codebase, No Conflicts',
    excerpt:
      'How we coordinate multiple Claude Code instances working on the same monorepo without stepping on each other.',
    publishedAt: '2026-03-22T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '03-multi-agent-coordination.md',
  },
  {
    slug: 'http-402-payments',
    title: 'Paying for AI API Calls with HTTP 402 and USDC',
    excerpt:
      'The design for agent-native micropayments: HTTP 402 plus USDC lets agents pay per API call without accounts or subscriptions. Code-complete and dormant behind a feature flag until the billing-readiness gate clears.',
    publishedAt: '2026-03-21T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '02-http-402-payments.md',
  },
  {
    slug: 'why-we-built-revealui',
    title: 'Why I Built RevealUI',
    excerpt: 'The origin story: why another business runtime, and what makes RevealUI different.',
    publishedAt: '2026-03-20T12:00:00.000Z',
    author: 'RevealUI Team',
    file: '01-why-we-built-revealui.md',
  },
];
