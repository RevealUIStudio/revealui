import { MarketingSection, SectionHeader } from '@revealui/presentation';
import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { NewsletterSignup } from '../components/NewsletterSignup';
import { BLOG_INDEX } from '../content/blog';
import { type BlogPost, fetchPosts } from '../lib/api';
import { staticBlogPosts } from '../lib/blog-posts';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getExcerpt(content: unknown): string {
  if (typeof content === 'string') {
    return content.length > 160 ? `${content.slice(0, 160)}...` : content;
  }
  if (content && typeof content === 'object' && 'root' in content) {
    const root = (
      content as { root: { children?: Array<{ children?: Array<{ text?: string }> }> } }
    ).root;
    if (root.children) {
      const text = root.children
        .flatMap((node) => node.children?.map((child) => child.text ?? '') ?? [])
        .join(' ')
        .trim();
      if (text) {
        return text.length > 160 ? `${text.slice(0, 160)}...` : text;
      }
    }
  }
  return BLOG_INDEX.readMore;
}

function staticToShared(post: (typeof staticBlogPosts)[number]): BlogPost {
  return {
    id: `static-${post.slug}`,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    publishedAt: post.publishedAt,
    createdAt: post.publishedAt,
    author: post.author,
    isStatic: true,
  };
}

export function BlogIndexPage() {
  // Initialize with static posts so the page paints immediately, then
  // merge in admin posts from /api/content/posts when they arrive.
  const [posts, setPosts] = useState<BlogPost[]>(() =>
    staticBlogPosts
      .map(staticToShared)
      .sort(
        (a, b) =>
          new Date(b.publishedAt ?? b.createdAt).getTime() -
          new Date(a.publishedAt ?? a.createdAt).getTime(),
      ),
  );

  useEffect(() => {
    let cancelled = false;
    fetchPosts().then((cmsPosts) => {
      if (cancelled) return;
      const cmsSlugs = new Set(cmsPosts.map((p) => p.slug));
      const staticPosts = staticBlogPosts.filter((p) => !cmsSlugs.has(p.slug)).map(staticToShared);
      const merged = [...cmsPosts, ...staticPosts].sort(
        (a, b) =>
          new Date(b.publishedAt ?? b.createdAt).getTime() -
          new Date(a.publishedAt ?? a.createdAt).getTime(),
      );
      setPosts(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MarketingSection
        tone="background"
        density="spacious"
        width="default"
        className="relative overflow-hidden"
        innerClassName="max-w-4xl text-center"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background"
        />
        <SectionHeader
          title={BLOG_INDEX.title}
          description={BLOG_INDEX.subtitle}
          titleAs="h1"
          align="center"
          titleClassName="font-display text-4xl sm:text-5xl lg:text-6xl"
          descriptionClassName="sm:text-xl"
        />
      </MarketingSection>

      <MarketingSection tone="secondary" density="default" width="default">
        {posts.length === 0 ? (
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-lg text-body">{BLOG_INDEX.empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 sm:gap-8">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl bg-card p-6 ring-1 ring-border transition-colors hover:ring-primary/30 sm:p-8"
              >
                <div className="flex items-center gap-x-4 text-xs text-muted-foreground">
                  <time dateTime={post.publishedAt ?? post.createdAt}>
                    {formatDate(post.publishedAt ?? post.createdAt)}
                  </time>
                  {post.author && <span>{post.author}</span>}
                </div>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-foreground">
                  <a href={`/blog/${post.slug}`} className="transition-colors hover:text-primary">
                    {post.title}
                  </a>
                </h3>
                <p className="mt-4 text-sm leading-6 text-body">
                  {post.excerpt ?? getExcerpt(post.content)}
                </p>
                <a
                  href={`/blog/${post.slug}`}
                  className="mt-4 inline-block text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  {BLOG_INDEX.readMore} →
                </a>
              </article>
            ))}
          </div>
        )}

        <div className="mx-auto mt-16 max-w-2xl rounded-2xl bg-secondary p-8 text-center ring-1 ring-border">
          <h3 className="text-lg font-semibold text-foreground">{BLOG_INDEX.notifyHeading}</h3>
          <p className="mb-6 mt-2 text-sm text-body">{BLOG_INDEX.notifyBody}</p>
          <NewsletterSignup variant="stacked" />
        </div>
      </MarketingSection>

      <Footer />
    </div>
  );
}
