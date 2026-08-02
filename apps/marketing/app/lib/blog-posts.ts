/**
 * Static blog posts for the marketing site.
 *
 * Markdown content is bundled at build time via Vite's import.meta.glob.
 * Renders without requiring the admin API. When the admin has published posts,
 * they take priority (by publishedAt date) and are merged with static posts on
 * the blog index.
 */

import { BLOG_POST_METADATA } from './blog-registry.js';

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

export const staticBlogPosts: StaticBlogPost[] = BLOG_POST_METADATA.map((meta) => ({
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
