/**
 * Static blog posts for the marketing site.
 *
 * Markdown content is bundled at build time via Vite's import.meta.glob.
 * Renders without requiring the admin API. When the admin has published posts,
 * they take priority (by publishedAt date) and are merged with static posts on
 * the blog index.
 */

export interface StaticBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date string */
  publishedAt: string;
  /** Markdown content */
  content: string;
  /** Author display name */
  author: string;
}

interface PostMeta {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  author: string;
  /** Filename in docs/blog/ */
  file: string;
}

const POST_METADATA: PostMeta[] = [
  {
    slug: 'ui-of-the-future',
    title: 'The UI of the Future Has Yet to Reveal Itself',
    excerpt:
      "The interface of the AI era is not a smarter chat window. It is your business itself, run by agents you own and can audit. If an agent did it, there's a receipt.",
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
      'Open the admin, type what you want done, and watch the agent do it, with streaming output, full tool visibility, and the same access control your users get.',
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
    title: '60 Components, One Dependency',
    excerpt:
      'A native React component library with 60 components and a single runtime dependency. No Radix, no MUI, no lock-in, just components you own.',
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
      'Coming soon: how the x402 protocol will enable agent-native micropayments without accounts or subscriptions. This post is the design.',
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

// Eager-load markdown files at build time. Vite resolves the glob relative to
// this module: ../../../../docs/blog/*.md → repo-root docs/blog/*.md.
const markdownFiles = import.meta.glob('../../../../docs/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function loadContent(filename: string): string {
  // Glob keys look like "../../../../docs/blog/01-why-we-built-revealui.md".
  const match = Object.entries(markdownFiles).find(([key]) => key.endsWith(`/${filename}`));
  return match ? match[1] : `*Content not found: ${filename}*`;
}

export const staticBlogPosts: StaticBlogPost[] = POST_METADATA.map((meta) => ({
  slug: meta.slug,
  title: meta.title,
  excerpt: meta.excerpt,
  publishedAt: meta.publishedAt,
  author: meta.author,
  content: loadContent(meta.file),
}));

export function getStaticPost(slug: string): StaticBlogPost | undefined {
  return staticBlogPosts.find((p) => p.slug === slug);
}
