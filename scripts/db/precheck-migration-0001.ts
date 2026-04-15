/**
 * Pre-check for migration 0001_special_logan.sql
 *
 * Validates that all existing rows satisfy the CHECK constraints
 * that migration 0001 will add. Run this BEFORE applying the migration
 * to catch data that would cause the ALTER TABLE to fail.
 *
 * Usage:
 *   POSTGRES_URL="postgres://..." pnpm tsx scripts/db/precheck-migration-0001.ts
 *
 * Exit codes:
 *   0 = all checks pass, safe to migrate
 *   1 = violations found, fix data before migrating
 *   2 = connection or query error
 */

import postgres from 'postgres';

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('ERROR: POSTGRES_URL environment variable is required');
  process.exit(2);
}

const sql = postgres(POSTGRES_URL, { ssl: 'require', max: 1 });

interface CheckSpec {
  table: string;
  column: string;
  allowedValues: string[];
  nullable?: boolean;
}

// Parse every CHECK constraint from migration 0001
const checks: CheckSpec[] = [
  {
    table: 'agent_actions',
    column: 'status',
    allowedValues: ['pending', 'running', 'completed', 'failed', 'cancelled'],
  },
  {
    table: 'agent_memories',
    column: 'type',
    allowedValues: [
      'fact',
      'preference',
      'decision',
      'feedback',
      'example',
      'correction',
      'skill',
      'warning',
    ],
  },
  { table: 'conversations', column: 'status', allowedValues: ['active', 'archived', 'ended'] },
  { table: 'messages', column: 'role', allowedValues: ['user', 'assistant', 'system'] },
  {
    table: 'user_devices',
    column: 'device_type',
    allowedValues: ['desktop', 'mobile', 'tablet', 'cli'],
    nullable: true,
  },
  {
    table: 'account_entitlements',
    column: 'metering_status',
    allowedValues: ['active', 'paused', 'exceeded'],
  },
  { table: 'account_memberships', column: 'role', allowedValues: ['owner', 'admin', 'member'] },
  {
    table: 'account_memberships',
    column: 'status',
    allowedValues: ['active', 'invited', 'revoked'],
  },
  { table: 'accounts', column: 'status', allowedValues: ['active', 'suspended', 'closed'] },
  { table: 'usage_meters', column: 'source', allowedValues: ['system', 'user', 'agent', 'api'] },
  { table: 'posts', column: 'status', allowedValues: ['draft', 'published', 'archived'] },
  {
    table: 'user_api_keys',
    column: 'provider',
    allowedValues: ['ollama', 'huggingface', 'vultr', 'inference-snaps'],
  },
  { table: 'app_logs', column: 'level', allowedValues: ['warn', 'error', 'fatal'] },
  { table: 'app_logs', column: 'app', allowedValues: ['admin', 'api', 'marketing', 'mainframe'] },
  { table: 'audit_log', column: 'severity', allowedValues: ['info', 'warn', 'critical'] },
  {
    table: 'circuit_breaker_state',
    column: 'state',
    allowedValues: ['closed', 'open', 'half-open'],
  },
  {
    table: 'code_provenance',
    column: 'author_type',
    allowedValues: ['ai_generated', 'human_written', 'ai_assisted', 'mixed'],
  },
  {
    table: 'code_provenance',
    column: 'review_status',
    allowedValues: ['unreviewed', 'reviewed', 'approved', 'rejected'],
  },
  {
    table: 'code_reviews',
    column: 'review_type',
    allowedValues: ['human_review', 'ai_review', 'human_approval', 'ai_suggestion'],
  },
  {
    table: 'code_reviews',
    column: 'status',
    allowedValues: ['approved', 'rejected', 'needs_changes', 'informational'],
  },
  {
    table: 'coordination_queue_items',
    column: 'priority',
    allowedValues: ['low', 'normal', 'high', 'urgent'],
  },
  {
    table: 'coordination_sessions',
    column: 'status',
    allowedValues: ['active', 'ended', 'crashed'],
  },
  {
    table: 'coordination_work_items',
    column: 'status',
    allowedValues: ['open', 'claimed', 'done', 'cancelled'],
  },
  {
    table: 'crdt_operations',
    column: 'crdt_type',
    allowedValues: ['lww_register', 'or_set', 'pn_counter'],
  },
  {
    table: 'crdt_operations',
    column: 'operation_type',
    allowedValues: ['set', 'add', 'remove', 'increment', 'decrement'],
  },
  { table: 'error_events', column: 'level', allowedValues: ['error', 'fatal', 'warn'] },
  { table: 'error_events', column: 'app', allowedValues: ['admin', 'api', 'marketing'] },
  {
    table: 'error_events',
    column: 'context',
    allowedValues: ['server', 'client', 'edge'],
    nullable: true,
  },
  {
    table: 'gdpr_breaches',
    column: 'severity',
    allowedValues: ['low', 'medium', 'high', 'critical'],
  },
  {
    table: 'gdpr_breaches',
    column: 'status',
    allowedValues: ['detected', 'investigating', 'notified', 'resolved'],
  },
  {
    table: 'gdpr_consents',
    column: 'type',
    allowedValues: ['necessary', 'functional', 'analytics', 'marketing', 'personalization'],
  },
  {
    table: 'gdpr_deletion_requests',
    column: 'status',
    allowedValues: ['pending', 'processing', 'completed', 'failed'],
  },
  {
    table: 'jobs',
    column: 'state',
    allowedValues: ['created', 'active', 'completed', 'failed', 'retry'],
  },
  {
    table: 'marketplace_servers',
    column: 'status',
    allowedValues: ['pending', 'active', 'suspended'],
  },
  {
    table: 'marketplace_transactions',
    column: 'status',
    allowedValues: ['pending', 'completed', 'failed'],
  },
  { table: 'node_id_mappings', column: 'entity_type', allowedValues: ['session', 'user'] },
  {
    table: 'pages',
    column: 'status',
    allowedValues: ['draft', 'published', 'archived', 'scheduled'],
  },
  {
    table: 'revealcoin_price_snapshots',
    column: 'source',
    allowedValues: ['jupiter', 'raydium', 'manual'],
  },
  {
    table: 'marketplace_agents',
    column: 'pricing_model',
    allowedValues: ['per-task', 'per-minute', 'flat'],
  },
  {
    table: 'marketplace_agents',
    column: 'status',
    allowedValues: ['draft', 'published', 'suspended', 'deprecated'],
  },
  {
    table: 'marketplace_agents',
    column: 'category',
    allowedValues: ['coding', 'writing', 'data', 'design', 'other'],
  },
  {
    table: 'task_submissions',
    column: 'status',
    allowedValues: ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled'],
  },
  {
    table: 'site_collaborators',
    column: 'role',
    allowedValues: ['owner', 'admin', 'editor', 'viewer'],
  },
  { table: 'sites', column: 'status', allowedValues: ['draft', 'published', 'archived'] },
  {
    table: 'tickets',
    column: 'status',
    allowedValues: ['backlog', 'todo', 'in_progress', 'review', 'done', 'closed'],
  },
  { table: 'tickets', column: 'priority', allowedValues: ['critical', 'high', 'medium', 'low'] },
  {
    table: 'tickets',
    column: 'type',
    allowedValues: ['bug', 'feature', 'task', 'improvement', 'epic'],
  },
  {
    table: 'rag_documents',
    column: 'source_type',
    allowedValues: ['admin_collection', 'url', 'file', 'text'],
  },
  {
    table: 'rag_documents',
    column: 'status',
    allowedValues: ['pending', 'processing', 'indexed', 'failed'],
  },
];

async function run(): Promise<void> {
  console.log('Migration 0001 Pre-Check');
  console.log('========================');
  console.log(`Checking ${checks.length} constraints against production data...\n`);

  let violations = 0;
  let skipped = 0;

  for (const check of checks) {
    try {
      // Check if table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = ${check.table}
        ) AS exists
      `;

      if (!tableExists[0].exists) {
        console.log(`  SKIP  ${check.table}.${check.column} — table does not exist`);
        skipped++;
        continue;
      }

      // Check if column exists
      const columnExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ${check.table}
            AND column_name = ${check.column}
        ) AS exists
      `;

      if (!columnExists[0].exists) {
        console.log(`  SKIP  ${check.table}.${check.column} — column does not exist`);
        skipped++;
        continue;
      }

      // Check if constraint already exists
      const constraintExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = ${check.table}
            AND constraint_type = 'CHECK'
            AND constraint_name LIKE ${`%${check.column}%check%`}
        ) AS exists
      `;

      if (constraintExists[0].exists) {
        console.log(`  DONE  ${check.table}.${check.column} — constraint already exists`);
        skipped++;
        continue;
      }

      // Find rows that violate the constraint
      const placeholders = check.allowedValues.map((_, i) => `$${i + 1}`).join(', ');
      const query = check.nullable
        ? `SELECT COUNT(*) AS cnt FROM "${check.table}" WHERE "${check.column}" IS NOT NULL AND "${check.column}" NOT IN (${placeholders})`
        : `SELECT COUNT(*) AS cnt FROM "${check.table}" WHERE "${check.column}" NOT IN (${placeholders})`;

      const result = await sql.unsafe(query, check.allowedValues);
      const count = Number(result[0].cnt);

      if (count > 0) {
        // Get sample bad values
        const sampleQuery = check.nullable
          ? `SELECT DISTINCT "${check.column}" FROM "${check.table}" WHERE "${check.column}" IS NOT NULL AND "${check.column}" NOT IN (${placeholders}) LIMIT 5`
          : `SELECT DISTINCT "${check.column}" FROM "${check.table}" WHERE "${check.column}" NOT IN (${placeholders}) LIMIT 5`;

        const samples = await sql.unsafe(sampleQuery, check.allowedValues);
        const badValues = samples.map((r: Record<string, unknown>) => r[check.column]);

        console.log(`  FAIL  ${check.table}.${check.column} — ${count} row(s) violate constraint`);
        console.log(`        Bad values: ${JSON.stringify(badValues)}`);
        console.log(`        Allowed:    ${JSON.stringify(check.allowedValues)}`);
        violations++;
      } else {
        console.log(`  OK    ${check.table}.${check.column}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ERR   ${check.table}.${check.column} — ${msg}`);
      violations++;
    }
  }

  console.log('\n========================');
  console.log(
    `Checked: ${checks.length - skipped}, Skipped: ${skipped}, Violations: ${violations}`,
  );

  if (violations > 0) {
    console.log('\n❌ Fix the violations above before running migration 0001.');
    process.exit(1);
  } else {
    console.log('\n✅ All checks pass. Safe to run: pnpm db:migrate');
    process.exit(0);
  }
}

run()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(2);
  })
  .finally(() => sql.end());
