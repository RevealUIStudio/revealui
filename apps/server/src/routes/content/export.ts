/**
 * Data Export API
 *
 * GET /api/content/export/:collection  -  Export collection data as JSON or CSV
 *
 * Supported collections: posts, pages, users, sites, media
 * Query params:
 *   format: 'json' | 'csv' (default: 'json')
 *   status: filter by status (optional)
 *
 * Auth: admin-only
 * Rate limit: 5 req/15min (exports can be heavy)
 */

import * as mediaQueries from '@revealui/db/queries/media';
import * as postQueries from '@revealui/db/queries/posts';
import * as siteQueries from '@revealui/db/queries/sites';
import * as userQueries from '@revealui/db/queries/users';
import { pages } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, eq, isNull } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { ErrorSchema } from '../_helpers/content-schemas.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of rows per export to prevent memory exhaustion */
const MAX_EXPORT_ROWS = 10_000;

/** Collections available for export */
const ALLOWED_COLLECTIONS = ['posts', 'pages', 'users', 'sites', 'media'] as const;
type CollectionName = (typeof ALLOWED_COLLECTIONS)[number];

/** Fields to exclude from user exports (sensitive authentication data) */
const USER_SENSITIVE_FIELDS = new Set([
  'password',
  'mfaSecret',
  'mfaBackupCodes',
  'emailVerificationToken',
  'sshKeyFingerprint',
]);

// =============================================================================
// CSV Helpers
// =============================================================================

/**
 * Escape a CSV field value according to RFC 4180.
 * Wraps in double quotes if the value contains commas, double quotes, or newlines.
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert an array of objects to a CSV string with headers.
 */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsvField).join(',');

  const dataLines = rows.map((row) =>
    headers.map((header) => escapeCsvField(row[header])).join(','),
  );

  return [headerLine, ...dataLines].join('\n');
}

// =============================================================================
// Data Fetchers
// =============================================================================

interface FetchOptions {
  status?: string;
  limit: number;
}

async function fetchCollection(
  db: Parameters<typeof postQueries.getAllPosts>[0],
  collection: CollectionName,
  options: FetchOptions,
): Promise<Record<string, unknown>[]> {
  const { status, limit } = options;

  switch (collection) {
    case 'posts': {
      const rows = await postQueries.getAllPosts(db, { status, limit, offset: 0 });
      return rows as unknown as Record<string, unknown>[];
    }
    case 'pages': {
      // Pages are scoped per-site in normal queries; export fetches across all sites
      const conditions = [isNull(pages.deletedAt), ...(status ? [eq(pages.status, status)] : [])];
      const result = await db
        .select()
        .from(pages)
        .where(and(...conditions))
        .limit(limit);
      return result as unknown as Record<string, unknown>[];
    }
    case 'users': {
      const rows = await userQueries.getAllUsers(db, { status, limit, offset: 0 });
      // Strip sensitive fields from user exports
      return rows.map((row) => {
        const record = { ...row } as Record<string, unknown>;
        for (const field of USER_SENSITIVE_FIELDS) {
          delete record[field];
        }
        return record;
      });
    }
    case 'sites': {
      const rows = await siteQueries.getAllSites(db, { status, limit, offset: 0 });
      return rows as unknown as Record<string, unknown>[];
    }
    case 'media': {
      const rows = await mediaQueries.getAllMedia(db, { limit, offset: 0 });
      return rows as unknown as Record<string, unknown>[];
    }
  }
}

// =============================================================================
// Route
// =============================================================================

const CollectionParam = z.object({
  collection: z.string().openapi({ param: { name: 'collection', in: 'path' }, example: 'posts' }),
});

const ExportQuery = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  status: z.string().optional(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/export/{collection}',
    tags: ['content'],
    summary: 'Export collection data as JSON or CSV',
    description:
      'Admin-only bulk export endpoint. Supported collections: posts, pages, users, sites, media. ' +
      'Limited to 10,000 rows per request.',
    request: {
      params: CollectionParam,
      query: ExportQuery,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              collection: z.string(),
              count: z.number(),
              data: z.array(z.record(z.string(), z.unknown())),
            }),
          },
          'text/csv': {
            schema: z.string(),
          },
        },
        description: 'Export data',
      },
      400: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Invalid collection',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Authentication required',
      },
      403: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Admin access required',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (user.role !== 'admin') {
      throw new HTTPException(403, { message: 'Admin access required' });
    }

    const { collection } = c.req.valid('param');
    const { format, status } = c.req.valid('query');

    // Validate collection name
    if (!ALLOWED_COLLECTIONS.includes(collection as CollectionName)) {
      return c.json(
        {
          success: false as const,
          error: `Invalid collection: ${collection}. Allowed: ${ALLOWED_COLLECTIONS.join(', ')}`,
        },
        400,
      );
    }

    const db = c.get('db');
    const rows = await fetchCollection(db, collection as CollectionName, {
      status,
      limit: MAX_EXPORT_ROWS,
    });

    // Serialize Date objects to ISO strings for consistent output
    const serializedRows = rows.map((row) => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        result[key] = value instanceof Date ? value.toISOString() : value;
      }
      return result;
    });

    if (format === 'csv') {
      const csv = toCsv(serializedRows);
      const timestamp = new Date().toISOString().slice(0, 10);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header(
        'Content-Disposition',
        `attachment; filename="${collection}-export-${timestamp}.csv"`,
      );
      return c.body(csv);
    }

    // JSON format (default)
    return c.json(
      {
        success: true as const,
        collection,
        count: serializedRows.length,
        data: serializedRows,
      },
      200,
    );
  },
);

export default app;
