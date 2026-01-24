# Triple Database Setup Guide

**Date:** 2025-01-16  
**Status:** ✅ Setup Script Ready | OpenAPI 3.2.0 Generator Ready  
**Architecture:** Triple Database (REST, Vector, ElectricSQL)

---

## Architecture Overview

RevealUI uses a **triple database architecture**:

1. **🟢 REST Database (NeonDB)** - All REST API tables
   - Users, sessions, sites, pages, media, posts
   - Agent contexts, conversations, actions
   - CRDT operations, node ID mappings
   - Rate limits, failed attempts

2. **🔵 Vector Database (Supabase)** - Vector search operations
   - `agent_memories` table with pgvector
   - HNSW indexes for similarity search
   - Optimized for semantic search

3. **⚡ ElectricSQL** - Real-time sync
   - Syncs from REST database (NeonDB)
   - Provides real-time subscriptions (shapes)
   - No separate database needed

---

## Setup Command

**Unified Setup:**
```bash
export $(grep -v '^#' .env | xargs)
pnpm test:db:setup
```

This single command sets up all three components:
- ✅ Vector Database (Supabase) - pgvector + agent_memories
- ✅ REST Database (NeonDB) - All REST API tables
- ✅ ElectricSQL - Verified connection to REST database

---

## Individual Setup

### Vector Database (Supabase)
```bash
pnpm test:memory:setup
```

### REST Database (NeonDB)
```bash
# Uses the same setup script, but only sets up REST tables
# The unified script handles both
```

### ElectricSQL
```bash
# ElectricSQL uses the REST database, so no separate setup needed
# Just start the service:
pnpm electric:service:start
```

---

## Database Details

### REST Database (NeonDB)

**Connection:** `POSTGRES_URL` or `DATABASE_URL`

**Tables:**
- `users` - User accounts
- `sessions` - Authentication sessions
- `sites` - Site management
- `pages` - Page content
- `page_revisions` - Page version history
- `site_collaborators` - Site access control
- `agent_contexts` - Agent working memory
- `conversations` - Agent conversations
- `agent_actions` - Agent tool executions
- `media` - Media files
- `posts` - Blog posts
- `global_settings`, `global_header`, `global_footer` - Global CMS settings
- `crdt_operations` - CRDT sync operations
- `node_id_mappings` - Entity ID mappings
- `rate_limits` - Rate limiting
- `failed_attempts` - Brute force protection

**Schema File:** `packages/db/migrations/neon-rest-setup.sql`

### Vector Database (Supabase)

**Connection:** `DATABASE_URL` (Supabase connection string)

**Tables:**
- `agent_memories` - Long-term agent memories with vector embeddings

**Extensions:**
- `pgvector` - Vector similarity search

**Indexes:**
- HNSW index for fast similarity search
- Filtering indexes (site_id, agent_id, type, created_at)

**Schema File:** `packages/db/migrations/supabase-vector-setup.sql`

### ElectricSQL

**Connection:** Uses same `POSTGRES_URL` as REST database

**Function:** Syncs from REST database for real-time subscriptions

**Setup:** No separate schema needed - syncs from existing REST tables

**Service:** Docker container (see `docker-compose.electric.yml`)

---

## OpenAPI 3.2.0 Specification

**Status:** ✅ Generator Ready

**Generate Spec:**
```bash
pnpm generate:openapi
```

**Output:** `openapi.json` (OpenAPI 3.2.0 format)

**Features:**
- OpenAPI 3.2.0 (most modern version as of 2025)
- Full JSON Schema 2020-12 support
- All REST API endpoints documented
- Authentication schemas
- Error responses
- Request/response examples

**View Spec:**
```bash
# Using Redocly CLI
pnpm dlx @redocly/cli preview-docs openapi.json

# Or validate
pnpm dlx @redocly/cli lint openapi.json
```

---

## Environment Variables

### Required

```bash
# REST Database (NeonDB)
POSTGRES_URL="postgresql://user:pass@neon.tech/dbname"

# Vector Database (Supabase)
DATABASE_URL="postgresql://user:pass@aws-0-region.pooler.supabase.com:6543/postgres"

# ElectricSQL (uses POSTGRES_URL)
# No separate connection needed
```

### Optional

```bash
# ElectricSQL Service
ELECTRIC_SERVICE_URL="http://localhost:5133"
ELECTRIC_PROTOCOL_PORT="65432"
```

---

## Verification

### Verify All Databases
```bash
pnpm test:memory:verify
```

**Expected Output:**
```
✅ REST Database Connection: Connected successfully
✅ Vector Database Connection: Connected successfully
✅ ElectricSQL: Ready (uses REST database)
✅ All tables: Present
✅ pgvector extension: Installed
```

### Run Tests
```bash
pnpm test:memory:all
```

---

## Architecture Benefits

### Separation of Concerns
- **REST Database:** Transactional operations, relational data
- **Vector Database:** Optimized for vector search (pgvector)
- **ElectricSQL:** Real-time sync without affecting performance

### Performance
- Vector operations isolated to Supabase (optimized for pgvector)
- REST operations on NeonDB (optimized for transactions)
- Real-time sync via ElectricSQL (non-blocking)

### Scalability
- Each database can scale independently
- Vector search doesn't impact REST API performance
- ElectricSQL handles real-time subscriptions efficiently

---

## Troubleshooting

### Vector Database Connection Fails
- Check `DATABASE_URL` is set to Supabase connection string
- Verify connection uses correct port (6543 for pooler, 5432 for direct)
- Ensure Supabase project is active

### REST Database Connection Fails
- Check `POSTGRES_URL` is set to NeonDB connection string
- Verify database exists and is accessible
- Check network connectivity

### ElectricSQL Fails
- Ensure REST database is set up first
- Check `POSTGRES_URL` is accessible
- Verify Docker container is running: `pnpm electric:service:start`
- Check logs: `pnpm electric:service:logs`

---

## Next Steps

1. ✅ Run unified setup: `pnpm test:db:setup`
2. ✅ Verify setup: `pnpm test:memory:verify`
3. ✅ Generate OpenAPI spec: `pnpm generate:openapi`
4. ✅ Run tests: `pnpm test:memory:all`
5. ⚠️ Start ElectricSQL service (optional): `pnpm electric:service:start`

---

**Last Updated:** 2026-01-16  
**Status:** ✅ Triple Database Setup Ready | ✅ OpenAPI 3.2.0 Generator Ready
