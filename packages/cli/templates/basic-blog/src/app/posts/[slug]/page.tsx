const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'

interface Post {
  id: string
  title: string
  slug: string
  content: unknown
  status: string
  publishedAt: string | null
}

async function getPost(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_URL}/api/posts?where[slug][equals]=${slug}&limit=1`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.docs?.[0] ?? null
  } catch {
    return null
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold">Post not found</h1>
        <p className="mt-4">
          <a href="/posts" className="text-accent underline">
            Back to blog
          </a>
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <nav className="mb-8">
        <a href="/posts" className="text-sm text-accent underline">
          &larr; Back to blog
        </a>
      </nav>
      <article>
        <h1 className="mb-2 text-3xl font-bold">{post.title}</h1>
        {post.publishedAt && (
          <time className="mb-8 block text-sm text-gray-500">
            {new Date(post.publishedAt).toLocaleDateString()}
          </time>
        )}
        <div className="prose">
          {typeof post.content === 'string' ? (
            <p>{post.content}</p>
          ) : (
            <p className="text-gray-500">Rich text content will render here.</p>
          )}
        </div>
      </article>
    </main>
  )
}
