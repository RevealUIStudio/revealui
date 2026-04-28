import { RichTextContent, type SerializedEditorState } from '@revealui/core/richtext/rsc';
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
      document.title = `${post.title} — RevealUI Blog`;
    }
  }, [post]);

  if (loading && !post) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-6 py-32 text-center text-gray-500">Loading…</div>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-white">
        <section className="flex flex-col items-center justify-center px-6 py-32 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">404</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Post not found
          </h1>
          <p className="mt-4 max-w-md text-base text-gray-600">
            That blog post does not exist or has been removed.
          </p>
          <a
            href="/blog"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Back to Blog
          </a>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <article className="py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          {/* Back link */}
          <a
            href="/blog"
            className="inline-flex items-center gap-x-1 text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors mb-8"
          >
            &larr; Back to Blog
          </a>

          {/* Header */}
          <header className="mb-12">
            <div className="flex items-center gap-x-4 text-sm text-gray-500">
              <time dateTime={post.publishedAt ?? post.createdAt}>
                {formatDate(post.publishedAt ?? post.createdAt)}
              </time>
              {post.author && <span>{post.author}</span>}
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
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
              <p className="text-gray-500 italic">Content rendering coming soon.</p>
            )}
          </div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
