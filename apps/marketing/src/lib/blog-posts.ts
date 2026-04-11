/**
 * Static blog posts for the marketing site.
 *
 * These posts are rendered locally without requiring the admin API.
 * When the admin has published posts, they take priority (by publishedAt date)
 * and are merged with static posts on the blog index.
 *
 * Content is loaded from docs/blog/ markdown files at request time (server-only).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/* ------------------------------------------------------------------ */
/*  Metadata registry (content loaded lazily from markdown files)      */
/* ------------------------------------------------------------------ */

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
    slug: 'getting-started',
    title: 'From Zero to Production in 10 Minutes',
    excerpt:
      'Build a complete business application with auth, content, and payments  -  faster than you can order lunch.',
    publishedAt: '2026-03-27T12:00:00.000Z',
    author: 'RevealUI Studio',
    file: '08-getting-started.md',
  },
  {
    slug: 'agent-first-future',
    title: 'Building for the Agent-First Internet',
    excerpt:
      'The web was built for browsers. The next web is being built for agents. How RevealUI is designed for both.',
    publishedAt: '2026-03-26T12:00:00.000Z',
    author: 'RevealUI Studio',
    file: '07-agent-first-future.md',
  },
  {
    slug: 'open-source-and-pro',
    title: 'Open Source + Pro: How We Think About Monetization',
    excerpt:
      'What is free, what is paid, and why. A transparent breakdown of the RevealUI business model.',
    publishedAt: '2026-03-25T12:00:00.000Z',
    author: 'RevealUI Studio',
    file: '06-open-source-and-pro.md',
  },
  {
    slug: 'five-primitives',
    title: 'The Five Primitives of Business Software',
    excerpt:
      'A deep technical walkthrough of Users, Content, Products, Payments, and Intelligence  -  the building blocks every software company needs.',
    publishedAt: '2026-03-24T12:00:00.000Z',
    author: 'RevealUI Studio',
    file: '05-five-primitives.md',
  },
  {
    slug: 'local-first-ai-stack',
    title: 'The Air-Gap Capable Business Stack',
    excerpt:
      'Your secrets in your own vault, your AI running locally, your dev environment reproducible from a single command.',
    publishedAt: '2026-03-23T12:00:00.000Z',
    author: 'RevealUI Studio',
    file: '04-local-first-ai-stack.md',
  },
  {
    slug: 'multi-agent-coordination',
    title: 'Three AI Agents, One Codebase, No Conflicts',
    excerpt:
      'How we coordinate multiple Claude Code instances working on the same monorepo without stepping on each other.',
    publishedAt: '2026-03-22T12:00:00.000Z',
    author: 'RevealUI Studio',
    file: '03-multi-agent-coordination.md',
  },
  {
    slug: 'http-402-payments',
    title: 'Paying for AI API Calls with HTTP 402 and USDC',
    excerpt:
      'How the x402 protocol enables agent-native micropayments without accounts or subscriptions.',
    publishedAt: '2026-03-21T12:00:00.000Z',
    author: 'RevealUI Studio',
    file: '02-http-402-payments.md',
  },
  {
    slug: 'why-we-built-revealui',
    title: 'Why We Built RevealUI',
    excerpt:
      'The origin story  -  why another business runtime, and what makes RevealUI different.',
    publishedAt: '2026-03-20T12:00:00.000Z',
    author: 'RevealUI Studio',
    file: '01-why-we-built-revealui.md',
  },
];

/* ------------------------------------------------------------------ */
/*  Content loader                                                     */
/* ------------------------------------------------------------------ */

/** Resolve docs/blog/ relative to the monorepo root. */
function getBlogDir(): string {
  // In Next.js, process.cwd() is the app root (apps/marketing).
  // The monorepo root is two levels up.
  return join(process.cwd(), '..', '..', 'docs', 'blog');
}

function loadContent(filename: string): string {
  try {
    return readFileSync(join(getBlogDir(), filename), 'utf-8');
  } catch {
    return `*Content not found: ${filename}*`;
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** All static blog posts, ordered newest-first. Content loaded on access. */
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
