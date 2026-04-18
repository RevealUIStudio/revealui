#!/usr/bin/env tsx

/**
 * Unreconciled Webhooks Check
 *
 * Queries the unreconciled_webhooks table for unresolved rows — events where
 * processing failed AND the idempotency marker could not be cleaned up. These
 * represent payments that were captured but never fulfilled.
 *
 * Exit codes:
 *   0 = no unresolved rows (or table doesn't exist yet)
 *   1 = unresolved rows found (prints JSON summary to stdout)
 *
 * Designed for GitHub Actions: the workflow parses stdout to create an issue.
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL or POSTGRES_URL required');
  process.exit(2);
}

interface UnreconciledRow {
  event_id: string;
  event_type: string;
  customer_id: string | null;
  stripe_object_id: string | null;
  error_trace: string;
  created_at: string;
}

async function main(): Promise<void> {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();

    // Check if table exists (may not be migrated in all environments)
    const tableCheck = await client.query(
      `SELECT to_regclass('public.unreconciled_webhooks') AS exists`,
    );
    if (!tableCheck.rows[0]?.exists) {
      console.log(JSON.stringify({ count: 0, rows: [], note: 'table does not exist' }));
      process.exit(0);
    }

    const result = await client.query<UnreconciledRow>(
      `SELECT event_id, event_type, customer_id, stripe_object_id, error_trace, created_at
       FROM unreconciled_webhooks
       WHERE resolved_at IS NULL
       ORDER BY created_at ASC`,
    );

    const output = {
      count: result.rowCount ?? 0,
      rows: result.rows.map((r) => ({
        eventId: r.event_id,
        eventType: r.event_type,
        customerId: r.customer_id,
        stripeObjectId: r.stripe_object_id,
        error: r.error_trace,
        createdAt: r.created_at,
      })),
    };

    console.log(JSON.stringify(output));
    process.exit(output.count > 0 ? 1 : 0);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Unreconciled check failed:', err instanceof Error ? err.message : err);
  process.exit(2);
});
