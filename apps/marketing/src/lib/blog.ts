const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown;
  publishedAt: string | null;
  createdAt: string;
}

interface PaginatedResult {
  docs: BlogPost[];
  totalDocs: number;
  totalPages: number;
  page: number;
}

export async function getPosts(page = 1, limit = 12): Promise<PaginatedResult> {
  try {
    const offset = (page - 1) * limit;
    const res = await fetch(
      `${API_URL}/api/content/posts?limit=${limit}&offset=${offset}&status=published`,
      { next: { revalidate: 300 } },
    );

    if (!res.ok) {
      return { docs: [], totalDocs: 0, totalPages: 0, page: 1 };
    }

    const json: { success: boolean; data: BlogPost[] } = await res.json();
    const docs = json.data ?? [];
    return {
      docs,
      totalDocs: docs.length,
      totalPages: 1,
      page,
    };
  } catch {
    return { docs: [], totalDocs: 0, totalPages: 0, page: 1 };
  }
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_URL}/api/content/posts/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const json: { success: boolean; data: BlogPost } = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}
