// @ts-nocheck
/**
 * Optimized Database Queries
 *
 * Examples of N+1 query elimination and query optimization
 * NOTE: This is example/documentation code - not actively used in production
 */

import { getClient } from '../client/index.js'

// TODO: Import from @revealui/core package once exports are configured
// import { monitorQuery } from '@revealui/core/monitoring/query-monitor'
// import { cacheQuery, cacheList } from '@revealui/core/cache/query-cache'

// Temporary stubs for build - replace with actual imports once core package exports are set up
const monitorQuery = <T>(_name: string, fn: () => Promise<T>) => fn()
const cacheQuery = <T>(_key: string, fn: () => Promise<T>) => fn()
const cacheList = <T>(_key: string, fn: () => Promise<T>) => fn()

// Get db client instance
const db = getClient()

// ============================================================================
// N+1 QUERY ELIMINATION
// ============================================================================

/**
 * BAD: N+1 Query Pattern
 * Fetches posts, then makes separate query for each author
 */
export async function getPostsWithAuthorsN1() {
  // First query: Get all posts
  const posts = await db.query('SELECT * FROM posts WHERE status = $1', ['published'])

  // N additional queries: One for each post's author
  for (const post of posts.rows) {
    const author = await db.query('SELECT * FROM users WHERE id = $1', [post.author_id])
    post.author = author.rows[0]
  }

  return posts.rows
}

/**
 * GOOD: Optimized with JOIN
 * Single query with all necessary data
 */
export async function getPostsWithAuthorsOptimized() {
  return monitorQuery('getPostsWithAuthors', async () => {
    const query = `
      SELECT
        p.id,
        p.title,
        p.slug,
        p.content,
        p.published_at,
        p.created_at,
        p.updated_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'avatar', u.avatar
        ) as author
      FROM posts p
      INNER JOIN users u ON u.id = p.author_id
      WHERE p.status = 'published'
      ORDER BY p.published_at DESC
    `

    const result = await db.query(query)
    return result.rows
  })
}

/**
 * BETTER: Optimized with caching
 */
export async function getPostsWithAuthorsCached() {
  return cacheList(
    'posts',
    { status: 'published' },
    () => getPostsWithAuthorsOptimized(),
    300, // 5 minutes
  )
}

// ============================================================================
// PAGINATION OPTIMIZATION
// ============================================================================

/**
 * BAD: OFFSET-based pagination (slow for large offsets)
 */
export async function getPostsPaginatedOffset(page: number, perPage: number) {
  const offset = (page - 1) * perPage

  const query = `
    SELECT * FROM posts
    WHERE status = 'published'
    ORDER BY published_at DESC
    LIMIT $1 OFFSET $2
  `

  const result = await db.query(query, [perPage, offset])
  return result.rows
}

/**
 * GOOD: Cursor-based pagination (faster for all positions)
 */
export async function getPostsPaginatedCursor(
  cursor?: string,
  perPage: number = 20,
) {
  return monitorQuery('getPostsPaginated', async () => {
    const query = cursor
      ? `
          SELECT * FROM posts
          WHERE status = 'published'
            AND published_at < (
              SELECT published_at FROM posts WHERE id = $1
            )
          ORDER BY published_at DESC
          LIMIT $2
        `
      : `
          SELECT * FROM posts
          WHERE status = 'published'
          ORDER BY published_at DESC
          LIMIT $1
        `

    const params = cursor ? [cursor, perPage] : [perPage]
    const result = await db.query(query, params)

    return {
      items: result.rows,
      nextCursor: result.rows.length === perPage
        ? result.rows[result.rows.length - 1].id
        : null,
    }
  })
}

// ============================================================================
// AGGREGATION OPTIMIZATION
// ============================================================================

/**
 * BAD: Multiple count queries
 */
export async function getPostStatsN1() {
  const totalPosts = await db.query('SELECT COUNT(*) FROM posts')
  const publishedPosts = await db.query(
    "SELECT COUNT(*) FROM posts WHERE status = 'published'",
  )
  const draftPosts = await db.query(
    "SELECT COUNT(*) FROM posts WHERE status = 'draft'",
  )

  return {
    total: totalPosts.rows[0].count,
    published: publishedPosts.rows[0].count,
    draft: draftPosts.rows[0].count,
  }
}

/**
 * GOOD: Single aggregation query
 */
export async function getPostStatsOptimized() {
  return monitorQuery('getPostStats', async () => {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'draft') as draft
      FROM posts
    `

    const result = await db.query(query)
    return result.rows[0]
  })
}

// ============================================================================
// BATCH LOADING
// ============================================================================

/**
 * BAD: Individual queries in loop
 */
export async function getUsersByIdsN1(ids: string[]) {
  const users = []
  for (const id of ids) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id])
    users.push(result.rows[0])
  }
  return users
}

/**
 * GOOD: Single query with IN clause
 */
export async function getUsersByIdsOptimized(ids: string[]) {
  return monitorQuery('getUsersByIds', async () => {
    const query = 'SELECT * FROM users WHERE id = ANY($1)'
    const result = await db.query(query, [ids])
    return result.rows
  })
}

// ============================================================================
// NESTED RELATIONSHIPS
// ============================================================================

/**
 * GOOD: Fetch posts with authors and comments in one query
 */
export async function getPostsWithRelations() {
  return monitorQuery('getPostsWithRelations', async () => {
    const query = `
      SELECT
        p.id,
        p.title,
        p.slug,
        p.content,
        p.published_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        ) as author,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'content', c.content,
              'created_at', c.created_at,
              'author', json_build_object(
                'id', cu.id,
                'name', cu.name
              )
            )
            ORDER BY c.created_at DESC
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as comments
      FROM posts p
      INNER JOIN users u ON u.id = p.author_id
      LEFT JOIN comments c ON c.post_id = p.id AND c.approved_at IS NOT NULL
      LEFT JOIN users cu ON cu.id = c.author_id
      WHERE p.status = 'published'
      GROUP BY p.id, u.id
      ORDER BY p.published_at DESC
      LIMIT 20
    `

    const result = await db.query(query)
    return result.rows
  })
}

// ============================================================================
// SEARCH OPTIMIZATION
// ============================================================================

/**
 * BAD: LIKE query without index
 */
export async function searchPostsSlow(query: string) {
  const sql = `
    SELECT * FROM posts
    WHERE title ILIKE $1 OR content ILIKE $1
    ORDER BY published_at DESC
  `

  const result = await db.query(sql, [`%${query}%`])
  return result.rows
}

/**
 * GOOD: Full-text search with GIN index
 */
export async function searchPostsOptimized(query: string) {
  return monitorQuery('searchPosts', async () => {
    const sql = `
      SELECT
        p.*,
        ts_rank(
          to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.content, '')),
          plainto_tsquery('english', $1)
        ) as rank
      FROM posts p
      WHERE to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.content, ''))
        @@ plainto_tsquery('english', $1)
      AND p.status = 'published'
      ORDER BY rank DESC, p.published_at DESC
      LIMIT 50
    `

    const result = await db.query(sql, [query])
    return result.rows
  })
}

// ============================================================================
// CONDITIONAL QUERIES
// ============================================================================

/**
 * Build dynamic query with proper indexing
 */
export async function getPostsFiltered(filters: {
  status?: string
  authorId?: string
  fromDate?: Date
  toDate?: Date
}) {
  return monitorQuery('getPostsFiltered', async () => {
    const conditions: string[] = []
    const params: unknown[] = []
    let paramCount = 1

    if (filters.status) {
      conditions.push(`status = $${paramCount}`)
      params.push(filters.status)
      paramCount++
    }

    if (filters.authorId) {
      conditions.push(`author_id = $${paramCount}`)
      params.push(filters.authorId)
      paramCount++
    }

    if (filters.fromDate) {
      conditions.push(`published_at >= $${paramCount}`)
      params.push(filters.fromDate)
      paramCount++
    }

    if (filters.toDate) {
      conditions.push(`published_at <= $${paramCount}`)
      params.push(filters.toDate)
      paramCount++
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    const query = `
      SELECT * FROM posts
      ${whereClause}
      ORDER BY published_at DESC
      LIMIT 100
    `

    const result = await db.query(query, params)
    return result.rows
  })
}

// ============================================================================
// MATERIALIZED VIEWS
// ============================================================================

/**
 * Create materialized view for expensive aggregations
 */
export async function createPostStatsMaterializedView() {
  const query = `
    CREATE MATERIALIZED VIEW IF NOT EXISTS post_stats_mv AS
    SELECT
      DATE_TRUNC('day', published_at) as date,
      COUNT(*) as post_count,
      COUNT(DISTINCT author_id) as author_count,
      AVG(LENGTH(content)) as avg_content_length
    FROM posts
    WHERE status = 'published'
    GROUP BY DATE_TRUNC('day', published_at)
    ORDER BY date DESC;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_post_stats_mv_date
    ON post_stats_mv(date);
  `

  await db.query(query)
}

/**
 * Refresh materialized view
 */
export async function refreshPostStats() {
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY post_stats_mv')
}

/**
 * Query materialized view (fast)
 */
export async function getPostStatsByDate(fromDate: Date, toDate: Date) {
  const query = `
    SELECT * FROM post_stats_mv
    WHERE date BETWEEN $1 AND $2
    ORDER BY date DESC
  `

  const result = await db.query(query, [fromDate, toDate])
  return result.rows
}

// ============================================================================
// QUERY RESULT TRANSFORMATION
// ============================================================================

/**
 * Efficient JSON aggregation
 */
export async function getUsersWithPostCounts() {
  return monitorQuery('getUsersWithPostCounts', async () => {
    const query = `
      SELECT
        u.id,
        u.name,
        u.email,
        json_build_object(
          'total', COUNT(p.id),
          'published', COUNT(p.id) FILTER (WHERE p.status = 'published'),
          'draft', COUNT(p.id) FILTER (WHERE p.status = 'draft')
        ) as post_stats
      FROM users u
      LEFT JOIN posts p ON p.author_id = u.id
      GROUP BY u.id
      ORDER BY COUNT(p.id) DESC
    `

    const result = await db.query(query)
    return result.rows
  })
}
