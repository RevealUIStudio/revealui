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
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Schemas
// =============================================================================

const SearchQuery = z.object({
  q: z
    .string()
    .min(2, 'Query must be at least 2 characters')
    .max(200, 'Query too long (max 200 characters)'),
  type: z.enum(['posts', 'pages', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const SearchResultItem = z.object({
  id: z.string(),
  title: z.string().nullable(),
  slug: z.string().nullable(),
  type: z.enum(['post', 'page']),
  status: z.string().nullable(),
  rank: z.number(),
  createdAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
});

const SearchResponse = z.object({
  query: z.string(),
  type: z.enum(['posts', 'pages', 'all']),
  results: z.array(SearchResultItem),
  count: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const ErrorResponse = z.object({ error: z.string() });

// =============================================================================
// Route
// =============================================================================

app.openapi(
  createRoute({
    method: 'get',
    path: '/search',
    tags: ['content'],
    summary: 'Full-text search across published content',
    description:
      'Uses PostgreSQL full-text search with plainto_tsquery. Searches published posts and/or pages.',
    request: {
      query: SearchQuery,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: SearchResponse } },
        description: 'Search results sorted by relevance',
      },
      400: {
        content: { 'application/json': { schema: ErrorResponse } },
        description: 'Invalid query parameters',
      },
    },
  }),
  async (c) => {
    const { q, type, limit, offset } = c.req.valid('query');

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

    const sliced = results.slice(0, limit);

    return c.json(
      {
        query: q,
        type,
        results: sliced.map((r) => ({
          ...r,
          createdAt: r.createdAt?.toISOString() ?? null,
        })),
        count: sliced.length,
        limit,
        offset,
      },
      200,
    );
  },
);

export default app;
