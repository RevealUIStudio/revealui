import { RichTextContent, type SerializedEditorState } from '@revealui/core/richtext/rsc';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import { Footer } from '@/components/Footer';
import { getPostBySlug } from '@/lib/blog';

export const revalidate = 300;

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: 'Post Not Found — RevealUI' };
  }

  return {
    title: `${post.title} — RevealUI Blog`,
    description: `Read "${post.title}" on the RevealUI blog.`,
    openGraph: {
      title: `${post.title} — RevealUI Blog`,
      description: `Read "${post.title}" on the RevealUI blog.`,
      type: 'article',
      publishedTime: post.publishedAt ?? post.createdAt,
    },
  };
}

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

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Article */}
      <article className="py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-x-1 text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors mb-8"
          >
            &larr; Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-12">
            <time dateTime={post.publishedAt ?? post.createdAt} className="text-sm text-gray-500">
              {formatDate(post.publishedAt ?? post.createdAt)}
            </time>
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
