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
      <h1 className="mb-8 text-3xl font-bold">Blog</h1>

      {posts.length === 0 ? (
        <p className="text-gray-500">
          No posts yet. Create your first post in the{' '}
          <a href="/admin/collections/posts" className="text-accent underline">
            admin panel
          </a>
          , or run <code className="rounded bg-gray-100 px-1">pnpm db:seed</code> to add sample
          data.
        </p>
      ) : (
        <ul className="space-y-6">
          {posts.map((post) => (
            <li key={post.id}>
              <a href={`/posts/${post.slug}`} className="group block">
                <h2 className="text-xl font-semibold group-hover:text-accent">{post.title}</h2>
                {post.publishedAt && (
                  <time className="text-sm text-gray-500">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </time>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
