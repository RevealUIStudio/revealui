/**
 * Content Search API
 *
 * GET /api/content/search?q=keyword&type=posts|pages|all&limit=20&offset=0
 *
 * Uses PostgreSQL full-text search with plainto_tsquery for safe user input.
 * Requires the add-search-indexes.sql migration to have been run.
 */

import { getClient } from '@revealui/db/client';
import { pages, posts } from '@revealui/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

const app = new Hono();

app.get('/search', async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q || q.length < 2) {
    return c.json({ error: 'Query must be at least 2 characters' }, 400);
  }
  if (q.length > 200) {
    return c.json({ error: 'Query too long (max 200 characters)' }, 400);
  }

  const type = c.req.query('type') ?? 'all';
  if (!['posts', 'pages', 'all'].includes(type)) {
    return c.json({ error: 'type must be posts, pages, or all' }, 400);
  }

  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);

  const db = getClient();
  const results: Array<{
    id: string;
    title: string | null;
    slug: string | null;
    type: 'post' | 'page';
    status: string | null;
    rank: number;
    createdAt: Date | null;
  }> = [];

  // plainto_tsquery is safe against injection — it treats input as plain text
  const tsquery = sql`plainto_tsquery('english', ${q})`;

  if (type === 'posts' || type === 'all') {
    const postResults = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        status: posts.status,
        createdAt: posts.createdAt,
        rank: sql<number>`ts_rank(search_vector, ${tsquery})`,
      })
      .from(posts)
      .where(and(sql`search_vector @@ ${tsquery}`, eq(posts.status, 'published')))
      .orderBy(desc(sql`ts_rank(search_vector, ${tsquery})`))
      .limit(limit)
      .offset(offset);

    for (const r of postResults) {
      results.push({ ...r, type: 'post' });
    }
  }

  if (type === 'pages' || type === 'all') {
    const pageResults = await db
      .select({
        id: pages.id,
        title: pages.title,
        slug: pages.slug,
        status: pages.status,
        createdAt: pages.createdAt,
        rank: sql<number>`ts_rank(search_vector, ${tsquery})`,
      })
      .from(pages)
      .where(and(sql`search_vector @@ ${tsquery}`, eq(pages.status, 'published')))
      .orderBy(desc(sql`ts_rank(search_vector, ${tsquery})`))
      .limit(limit)
      .offset(offset);

    for (const r of pageResults) {
      results.push({ ...r, type: 'page' });
    }
  }

  // Sort combined results by rank descending
  results.sort((a, b) => b.rank - a.rank);

  return c.json({
    query: q,
    type,
    results: results.slice(0, limit),
    count: results.length,
    limit,
    offset,
  });
});

export default app;
