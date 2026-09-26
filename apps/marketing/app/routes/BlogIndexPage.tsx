import { MarketingSection, SectionHeader } from '@revealui/presentation';
import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { NewsletterSignup } from '../components/NewsletterSignup';
import { BLOG_INDEX } from '../content/blog';
import { type BlogPost, fetchPosts } from '../lib/api';
import { staticBlogPosts } from '../lib/blog-posts';

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function staticToShared(post: (typeof staticBlogPosts)[number]): BlogPost {
  return {
    id: post.slug,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    publishedAt: post.publishedAt,
    createdAt: post.publishedAt,
    author: post.author,
  };
}

function byPublishedDesc(a: BlogPost, b: BlogPost): number {
  const left = a.publishedAt ?? '';
  const right = b.publishedAt ?? '';
  if (left === right) return 0;
  return left < right ? 1 : -1;
}

export function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>(() =>
    staticBlogPosts
      .slice()
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      .map(staticToShared),
  );

  useEffect(() => {
    let cancelled = false;
    fetchPosts()
      .then((cms) => {
        if (cancelled || !cms?.length) return;
        const cmsSlugs = new Set(cms.map((p) => p.slug));
        const staticPosts = staticBlogPosts
          .filter((p) => !cmsSlugs.has(p.slug))
          .map(staticToShared);
        const merged = [...cms, ...staticPosts].sort(byPublishedDesc);
        setPosts(merged);
      })
      .catch(() => {
        // Static posts already painted; a failed CMS fetch leaves them in place.
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
        backdrop={
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background"
          />
        }
      >
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
                className="flex flex-col rounded-2xl bg-card p-6 ring-1 ring-border transition-shadow hover:shadow-md sm:p-8"
              >
                <time className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {formatDate(post.publishedAt ?? '')}
                </time>
                <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">
                  <a href={`/blog/${post.slug}`} className="transition-colors hover:text-primary">
                    {post.title}
                  </a>
                </h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-body">{post.excerpt}</p>
                <a
                  href={`/blog/${post.slug}`}
                  className="mt-4 text-sm font-semibold text-primary hover:text-primary/80"
                >
                  {BLOG_INDEX.readMore}
                </a>
              </article>
            ))}
          </div>
        )}
      </MarketingSection>

      <MarketingSection tone="background" density="compact" width="narrow">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">{BLOG_INDEX.notifyHeading}</h2>
          <p className="mt-2 text-sm text-body">{BLOG_INDEX.notifyBody}</p>
          <div className="mt-6">
            <NewsletterSignup variant="stacked" />
          </div>
        </div>
      </MarketingSection>

      <Footer />
    </div>
  );
}
