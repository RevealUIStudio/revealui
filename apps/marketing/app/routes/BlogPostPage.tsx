import { RichTextContent, type SerializedEditorState } from '@revealui/core/richtext/rsc';
import { ButtonCVA } from '@revealui/presentation';
import { useParams } from '@revealui/router';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { Footer } from '../components/Footer';
import { type BlogPost, fetchPostBySlug } from '../lib/api';
import { getStaticPost } from '../lib/blog-posts';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isLexicalState(content: unknown): content is SerializedEditorState {
  return (
    content !== null &&
    typeof content === 'object' &&
    'root' in content &&
    typeof (content as Record<string, unknown>).root === 'object'
  );
}

function staticToBlogPost(slug: string): BlogPost | null {
  const staticPost = getStaticPost(slug);
  if (!staticPost) return null;
  return {
    id: `static-${staticPost.slug}`,
    title: staticPost.title,
    slug: staticPost.slug,
    excerpt: staticPost.excerpt,
    content: staticPost.content,
    publishedAt: staticPost.publishedAt,
    createdAt: staticPost.publishedAt,
    author: staticPost.author,
    isStatic: true,
  };
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    // Synchronous static fallback first, so the page paints with content
    // immediately while the API call is in flight.
    const staticPost = staticToBlogPost(slug);
    if (staticPost) {
      setPost(staticPost);
    }
    fetchPostBySlug(slug).then((cmsPost) => {
      if (cancelled) return;
      if (cmsPost) {
        setPost(cmsPost);
      } else if (!staticPost) {
        setPost(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (post) {
      document.title = `${post.title} | RevealUI Blog`;
    }
  }, [post]);

  if (loading && !post) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-6 py-32 text-center text-muted-foreground">
          Loading…
        </div>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <section className="flex flex-col items-center justify-center px-6 py-32 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Post not found
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            That blog post does not exist or has been removed.
          </p>
          <ButtonCVA asChild variant="primary" className="mt-8">
            <a href="/blog">Back to Blog</a>
          </ButtonCVA>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <article className="py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          {/* Back link */}
          <a
            href="/blog"
            className="inline-flex items-center gap-x-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors mb-8"
          >
            &larr; Back to Blog
          </a>

          {/* Header */}
          <header className="mb-12">
            <div className="flex items-center gap-x-4 text-sm text-muted-foreground">
              <time dateTime={post.publishedAt ?? post.createdAt}>
                {formatDate(post.publishedAt ?? post.createdAt)}
              </time>
              {post.author && <span>{post.author}</span>}
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {post.title}
            </h1>
          </header>

          {/* Content */}
          <div className="prose prose-gray prose-lg max-w-none">
            {isLexicalState(post.content) ? (
              <RichTextContent data={post.content} />
            ) : typeof post.content === 'string' ? (
              <Markdown>{post.content}</Markdown>
            ) : (
              <p className="text-muted-foreground italic">Content rendering coming soon.</p>
            )}
          </div>
        </div>
      </article>

      <section className="border-t border-border bg-secondary py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to build?
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Users, content, products, payments, and intelligence, pre-wired. Start locally in minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonCVA asChild size="lg" variant="primary">
              <a href="https://admin.revealui.com/signup">Start free</a>
            </ButtonCVA>
            <ButtonCVA asChild size="lg" variant="outline">
              <a href="https://docs.revealui.com">Read the docs</a>
            </ButtonCVA>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
