# Database Migrations

This directory contains versioned SQL migrations managed by Drizzle Kit.

## Current Migrations

| Migration | Tables | Description |
|-----------|--------|-------------|
| `0000_unique_red_hulk.sql` | 24 | Initial schema: users, sessions, sites, pages, agents, CMS, todos |
| `0001_long_maximus.sql` | 1 | Add waitlist table for landing page signups |

**Total Tables:** 25

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

### Tables by Migration

**0000_unique_red_hulk.sql (Initial Schema):**
- **Auth:** users, sessions, password_reset_tokens, failed_attempts
- **Sites:** sites, site_collaborators, pages, page_revisions
- **Agents:** agent_actions, agent_contexts, agent_memories, conversations, messages
- **CMS:** posts, media, global_header, global_footer, global_settings
- **Sync:** sync_metadata, user_devices, crdt_operations, node_id_mappings
- **Rate Limiting:** rate_limits
- **App:** todos

**0001_long_maximus.sql:**
- **Landing:** waitlist (email signups with source tracking)

## Rollback Strategy

Drizzle Kit does not generate automatic rollback migrations. For schema changes that need rollback:

1. Create a new forward migration that reverts changes
2. Test rollback in staging environment
3. Document rollback steps in deployment notes

## Adding New Tables

1. Define table in `packages/db/src/schema/*.ts`
2. Export from appropriate schema file (rest.ts or vector.ts)
3. Build package: `pnpm build`
4. Generate migration: `pnpm db:generate`
5. Review generated SQL in `migrations/`
6. Apply migration: `pnpm db:migrate`
7. Commit migration files to version control

## Migration Metadata

Migration metadata is stored in `meta/_journal.json` and should be committed with migration files.
