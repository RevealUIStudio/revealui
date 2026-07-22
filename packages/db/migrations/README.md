---
title: "Database Migrations"
description: "This directory contains versioned SQL migrations managed by Drizzle Kit."
visibility: internal
status: verified
audience: maintainer
---

# Database Migrations

This directory contains versioned SQL migrations managed by Drizzle Kit.

## Current Migrations

28 migrations applied (0000–0027). See `meta/_journal.json` for the canonical list.

| Migration tag | Description |
|---------------|-------------|
| `0000_init` | Initial schema |
| `0001_special_logan` | Schema additions |
| `0002_triggers_search_vectors` | Search vector triggers |
| `0003_shared_facts` | Shared facts table |
| `0004_yjs_document_patches` | YJS document patches |
| `0005_shared_memory_scope` | Shared memory scope |
| `0006_must_rotate_password` | Password rotation flag |
| `0007_account_membership_seat_limit` | Account membership seat limit |
| `0008_jobs_visibility_timeout` | Jobs visibility timeout |
| `0009_mcp_document_operations` | MCP document operations |
| `0010_unreconciled_webhooks` | Webhook reconciliation |
| `0011_usage_meters_duration_ms` | Usage meters duration |
| `0012_living_stone_men` | Schema additions |
| `0013_zippy_quentin_quire` | Schema additions |
| `0014_licenses_userid_set_null` | Licenses userId nullable |
| `0015_users_stripe_deletion_status` | Users Stripe deletion status |
| `0016_drop_revealcoin_tables` | Drop RevealCoin tables |
| `0017_webhook_idempotency_state` | Webhook idempotency state |
| `0018_eager_killmonger` | Schema additions |
| `0019_clean_thor_girl` | Schema additions |
| `0020_productive_scarecrow` | Schema additions |
| `0021_knowledge_graph` | Knowledge graph tables |
| `0022_kg_search_text` | Knowledge graph search text |
| `0023_entitlement_trialing_last_event` | Entitlement trial last event |
| `0024_widen_provider_check_anthropic_openai` | Provider check widening |
| `0025_add_nudge_dismissals` | Nudge dismissals |
| `0026_audit_log_append_only` | Audit log append-only |
| `0027_open_storm` | Schema additions |

**Total Tables:** 96 (recount `pgTable(` under `packages/db/src/schema`; keep in lockstep with `pnpm validate:claims`)

## Migration Strategy

### Development
```bash
# Generate new migration after schema changes
cd packages/db
pnpm db:generate

# Apply migrations to database
pnpm db:migrate
```

### Production
```bash
# Run migrations as part of deployment
DATABASE_URL="postgresql://..." pnpm db:migrate
```

## DO NOT Use `drizzle-kit push`

❌ **Avoid:** `pnpm db:push` - Bypasses migrations, no version control

✅ **Use:** `pnpm db:generate` + `pnpm db:migrate` - Versioned migrations with rollback capability

## Migration Files

All migrations are tracked in `meta/_journal.json` and applied in order.

## Rollback Strategy

Drizzle Kit does not generate automatic rollback migrations. For schema changes that need rollback:

1. Create a new forward migration that reverts changes
2. Test rollback in staging environment
3. Document rollback steps in deployment notes

## Adding New Tables

1. Define table in `packages/db/src/schema/*.ts`
2. Export from appropriate schema file
3. Build package: `pnpm build`
4. Generate migration: `pnpm db:generate`
5. Review generated SQL in `migrations/`
6. Apply migration: `pnpm db:migrate`
7. Commit migration files to version control

## Migration Metadata

Migration metadata is stored in `meta/_journal.json` and should be committed with migration files.
