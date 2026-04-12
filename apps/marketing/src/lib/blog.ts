import { getStaticPost, type StaticBlogPost, staticBlogPosts } from './blog-posts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown;
  publishedAt: string | null;
  createdAt: string;
  /** Author display name (static posts only). */
  author?: string;
  /** Whether this post comes from the static registry vs the admin. */
  isStatic?: boolean;
}

interface PaginatedResult {
  docs: BlogPost[];
  totalDocs: number;
  totalPages: number;
  page: number;
}

/** Convert a static blog post into the shared BlogPost shape. */
function toShared(post: StaticBlogPost): BlogPost {
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

/**
 * Fetch published posts from the admin API, falling back to an empty list on
 * error. Static blog posts are always appended and de-duped by slug (admin
 * posts with a matching slug take priority).
 */
export async function getPosts(page = 1, limit = 12): Promise<PaginatedResult> {
  let cmsPosts: BlogPost[] = [];

  try {
    const offset = (page - 1) * limit;
    const res = await fetch(
      `${API_URL}/api/content/posts?limit=${limit}&offset=${offset}&status=published`,
      { next: { revalidate: 300 } },
    );

    if (res.ok) {
      const json: { success: boolean; data: BlogPost[] } = await res.json();
      cmsPosts = json.data ?? [];
    }
  } catch {
    // admin unreachable  -  static posts still render.
  }

  // Merge: admin posts take priority when slugs overlap.
  const cmsSlugs = new Set(cmsPosts.map((p) => p.slug));
  const staticPosts = staticBlogPosts.filter((p) => !cmsSlugs.has(p.slug)).map(toShared);

  const merged = [...cmsPosts, ...staticPosts].sort((a, b) => {
    const dateA = a.publishedAt ?? a.createdAt;
    const dateB = b.publishedAt ?? b.createdAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return {
    docs: merged,
    totalDocs: merged.length,
    totalPages: 1,
    page,
  };
}

/**
 * Fetch a single post by slug. Checks the admin first, then falls back to the
 * static registry.
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_URL}/api/content/posts/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const json: { success: boolean; data: BlogPost } = await res.json();
      if (json.data) return json.data;
    }
  } catch {
    // admin unreachable  -  fall through to static lookup.
  }

  const staticPost = getStaticPost(slug);
  return staticPost ? toShared(staticPost) : null;
}
