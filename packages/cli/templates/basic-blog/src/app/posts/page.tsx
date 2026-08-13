import { Heading, LinkButton, Text } from '@revealui/presentation';

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
}

async function getPosts(): Promise<Post[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/posts?where[status][equals]=published&sort=-publishedAt`,
      {
        cache: 'no-store',
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.docs ?? [];
  } catch {
    return [];
  }
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Heading className="mb-8">Blog</Heading>

      {posts.length === 0 ? (
        <Text>
          No posts yet. Create your first post in the{' '}
          <LinkButton href="/admin/collections/posts" appearance="link" size="sm">
            admin panel
          </LinkButton>
          , or run <code className="rounded bg-gray-100 px-1">pnpm db:seed</code> to add sample
          data.
        </Text>
      ) : (
        <ul className="space-y-6">
          {posts.map((post) => (
            <li key={post.id}>
              <LinkButton
                href={`/posts/${post.slug}`}
                appearance="link"
                className="h-auto flex-col items-start"
              >
                <Heading level={2} className="text-xl">
                  {post.title}
                </Heading>
                {post.publishedAt && (
                  <time className="text-sm text-gray-500">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </time>
                )}
              </LinkButton>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
