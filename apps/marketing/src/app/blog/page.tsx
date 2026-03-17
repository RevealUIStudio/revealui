import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { getPosts } from '@/lib/blog';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Blog — RevealUI',
  description: 'Updates, guides, and insights from the RevealUI team.',
  openGraph: {
    title: 'Blog — RevealUI',
    description: 'Updates, guides, and insights from the RevealUI team.',
    type: 'website',
  },
};

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
  // Lexical JSON — extract text from root.children paragraphs
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
  return 'Read more';
}

export default async function BlogPage() {
  const { docs: posts } = await getPosts();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Blog
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            Updates, guides, and insights from the RevealUI team.
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {posts.length === 0 ? (
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-lg text-gray-600">No posts yet — check back soon.</p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Back to Home
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200 hover:ring-blue-300 transition-all"
                >
                  <div className="flex items-center gap-x-4 text-xs text-gray-500">
                    <time dateTime={post.publishedAt ?? post.createdAt}>
                      {formatDate(post.publishedAt ?? post.createdAt)}
                    </time>
                  </div>
                  <h3 className="mt-3 text-xl font-bold tracking-tight text-gray-900">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-gray-600">{getExcerpt(post.content)}</p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    Read more &rarr;
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
