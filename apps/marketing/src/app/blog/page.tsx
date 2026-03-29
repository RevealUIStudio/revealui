import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { NewsletterSignup } from '@/components/NewsletterSignup';
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
              <p className="text-lg text-gray-600">
                No posts yet. Check back soon for updates from the RevealUI team.
              </p>
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
                    {post.author && <span>{post.author}</span>}
                  </div>
                  <h3 className="mt-3 text-xl font-bold tracking-tight text-gray-900">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    {post.excerpt ?? getExcerpt(post.content)}
                  </p>
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

          {/* Engineering blog links */}
          <div className="mx-auto mt-24 max-w-4xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 mb-8">
              More from the engineering blog
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[
                {
                  title: 'The Five Primitives',
                  description:
                    'A deep technical walkthrough of Users, Content, Products, Payments, and Intelligence.',
                  href: 'https://docs.revealui.com/docs/blog/02-five-primitives',
                },
                {
                  title: 'HTTP 402 and the Future of Payments',
                  description:
                    'How the x402 protocol enables agent-native micropayments without accounts or subscriptions.',
                  href: 'https://docs.revealui.com/docs/blog/02-http-402-payments',
                },
                {
                  title: 'Multi-Agent Coordination',
                  description:
                    'How we coordinate multiple AI agents working on the same codebase without conflicts.',
                  href: 'https://docs.revealui.com/docs/blog/03-multi-agent-coordination',
                },
                {
                  title: 'The Local-First AI Stack',
                  description:
                    'Building AI features that work offline with ElectricSQL sync and local model inference.',
                  href: 'https://docs.revealui.com/docs/blog/04-local-first-ai-stack',
                },
              ].map((post) => (
                <a
                  key={post.title}
                  href={post.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 hover:ring-blue-300 transition-all group"
                >
                  <h3 className="text-lg font-bold tracking-tight text-gray-900 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{post.description}</p>
                  <span className="mt-4 inline-block text-sm font-semibold text-blue-600 group-hover:text-blue-500 transition-colors">
                    Read on docs site &rarr;
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Newsletter capture */}
          <div className="mx-auto mt-16 max-w-2xl rounded-2xl bg-gray-50 p-8 text-center ring-1 ring-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Get notified when we publish</h3>
            <p className="mt-2 text-sm text-gray-600 mb-6">
              Engineering insights, product updates, and launch announcements. No spam.
            </p>
            <NewsletterSignup variant="stacked" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
