/**
 * GAP-467 P1: title + excerpt claims for every live static blog post.
 * Bodies: later phases (see .jv docs/specs/2026-08-02-blog-claims-evidence.md).
 */
import type { ClaimEntry } from './types.js';

export const blogMetaClaims: readonly ClaimEntry[] = [
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'title',
    text: 'The open runtime for forward-deployed agent work',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug open-runtime-for-fde-work',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'excerpt',
    text: 'Demos die at the customer wall. Forward deployed work only finishes when the customer still owns the runtime after you leave.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug open-runtime-for-fde-work',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'title',
    text: 'I Built This So More People Could Own the Upside of AI',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug shareable-upside',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'excerpt',
    text: 'AI is splitting outcomes. I spent the longer path building a self-hosted runtime so more people could own the tools, not only rent them.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug shareable-upside',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'title',
    text: 'The UI of the Future Has Yet to Reveal Itself',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug ui-of-the-future',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'excerpt',
    text: 'The interface of the AI era is not a smarter chat window. It is your business itself, run by agents you own.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug ui-of-the-future',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'title',
    text: 'One Runtime, Eight Products: The RevFleet Family',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug revfleet-product-family',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'excerpt',
    text: 'You do not adopt a framework, you adopt a fleet. RevealUI is the flagship runtime, and seven sister products extend it, from an encrypted secret vault to an agent tool marketplace.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug revfleet-product-family',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-registry.test.ts#revfleet product family excerpt mentions encrypted secrets product',
        note: 'GAP-467 registry lock for capability-shaped excerpt',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'title',
    text: 'Run Your Admin by Talking to It',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug dashboard-agent-chat',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'excerpt',
    text: 'Open the admin, type what you want done, and watch the agent do it, with streaming output and full tool visibility.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug dashboard-agent-chat',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'title',
    text: "Your Secrets Don't Belong in a .env File",
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug own-your-secrets',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'excerpt',
    text: 'The default bargain puts your credentials in a vendor dashboard or a plaintext .env file. RevVault keeps them age-encrypted on hardware you control, never as plaintext on disk.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug own-your-secrets',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-registry.test.ts#own your secrets excerpt says credentials never sit as plaintext on disk',
        note: 'GAP-467 registry lock for capability-shaped excerpt',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'title',
    text: 'Building a Codebase With Zero Hand-Written Regex',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug zero-regex',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'excerpt',
    text: 'We banned hand-written regular expressions across the entire fleet. Here is what we use instead, and why it makes the code safer and easier to read.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug zero-regex',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'title',
    text: 'The Marketing Site That Fails CI When It Lies',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug claim-drift',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'excerpt',
    text: 'Every number on revealui.com is checked against the code on every push. When a stat drifts from reality, the build breaks before the lie ships.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug claim-drift',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-registry.test.ts#claim drift excerpt says every number is checked against the code',
        note: 'GAP-467 registry lock for capability-shaped excerpt',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'title',
    text: '66 Components, One Dependency',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug component-library',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'excerpt',
    text: 'A native React component library with 66 components and a single runtime dependency. No Radix, no MUI, no lock-in, just components you own.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug component-library',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'title',
    text: 'Your Database, Your Storage, Your Sync',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug own-your-data',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'excerpt',
    text: 'Standard Postgres, S3-compatible storage, and real-time sync, all built in and all portable. The data layer you can actually leave.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug own-your-data',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-registry.test.ts#own your data excerpt claims real-time sync in the product stack',
        note: 'GAP-467 registry lock for capability-shaped excerpt',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'title',
    text: 'From Zero to Production in About 30 Minutes',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug getting-started',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'excerpt',
    text: 'Build a complete business application with auth, content, and payments: from zero to deployed in about 30 minutes.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug getting-started',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'title',
    text: 'Building for the Agent-First Internet',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug agent-first-future',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'excerpt',
    text: 'The web was built for browsers. The next web is being built for agents. How RevealUI is designed for both.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug agent-first-future',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'title',
    text: 'Open Source + Pro: How We Think About Monetization',
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug open-source-and-pro',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'excerpt',
    text: 'What is free, what is paid, and why. A transparent breakdown of the RevealUI business model.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug open-source-and-pro',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'title',
    text: 'The Five Primitives of Business Software',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug five-primitives',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'excerpt',
    text: 'A deep technical walkthrough of People, Content, Offers, Payments, and Agents: the building blocks every software company needs.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug five-primitives',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-registry.test.ts#five primitives excerpt says every software company needs the building blocks',
        note: 'GAP-467 registry lock for capability-shaped excerpt',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'title',
    text: 'The Air-Gap-Capable Business Runtime',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug local-first-ai-stack',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'excerpt',
    text: 'Your secrets in your own vault, your AI running locally, your dev environment reproducible from a single command.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug local-first-ai-stack',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'title',
    text: 'Three AI Agents, One Codebase, No Conflicts',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug multi-agent-coordination',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'excerpt',
    text: 'How we coordinate multiple Claude Code instances working on the same monorepo without stepping on each other.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug multi-agent-coordination',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'title',
    text: 'Paying for AI API Calls with HTTP 402 and USDC',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug http-402-payments',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'excerpt',
    text: 'The design for agent-native micropayments: HTTP 402 plus USDC lets agents pay per API call without accounts or subscriptions. Code-complete and dormant behind a feature flag until the billing-readiness gate clears.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'static post body source' },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug http-402-payments',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'title',
    text: 'Why I Built RevealUI',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug why-we-built-revealui',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'excerpt',
    text: 'The origin story: why another business runtime, and what makes RevealUI different.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'static post body source',
      },
      {
        kind: 'code',
        ref: 'apps/marketing/app/lib/blog-registry.ts',
        note: 'live registry row for slug why-we-built-revealui',
      },
    ],
  },
] as const;
