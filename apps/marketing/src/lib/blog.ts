const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: unknown;
  publishedAt: string | null;
  createdAt: string;
  // biome-ignore lint/style/useNamingConvention: CMS API returns _json field with raw Lexical content
  _json?: Record<string, unknown>;
}

interface PaginatedResult {
  docs: BlogPost[];
  totalDocs: number;
  totalPages: number;
  page: number;
}

export async function getPosts(page = 1, limit = 12): Promise<PaginatedResult> {
  try {
    const res = await fetch(`${API_URL}/api/posts?page=${page}&limit=${limit}`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return { docs: [], totalDocs: 0, totalPages: 0, page: 1 };
    }

    return res.json();
  } catch {
    return { docs: [], totalDocs: 0, totalPages: 0, page: 1 };
  }
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_URL}/api/posts/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    return res.json();
  } catch {
    return null;
  }
}
