# Memory Integration Tests

Integration tests for vector memory functionality, dual database architecture, and EpisodicMemory integration.

## Prerequisites

### Required Environment Variables

Set these environment variables before running tests:

- `DATABASE_URL` - Supabase (vector database) connection string
- `POSTGRES_URL` - NeonDB (REST database) connection string  
- `OPENAI_API_KEY` - OpenAI API key for generating embeddings

See [`env.test.example`](../../../env.test.example) for details.

### Database Setup

1. **Supabase Database** (Vector Database)
   - Must have `pgvector` extension enabled
   - Must have `agent_memories` table created
   - Run migration: `pnpm test:memory:setup`

2. **NeonDB Database** (REST Database)
   - Standard PostgreSQL database
   - Used for CRDT state and other REST operations

## Quick Start

### 1. Verify Setup

```bash
pnpm test:memory:verify
```

This checks:
- Environment variables are set
- Database connections work
- Schema is correct
- pgvector extension is installed
- Indexes exist

### 2. Setup Database (if needed)

```bash
pnpm test:memory:setup
```

This runs the migration to:
- Enable pgvector extension
- Create `agent_memories` table
- Create HNSW indexes

### 3. Run Tests

```bash
# Run all memory tests
pnpm test:memory:all

# Run specific test suite
pnpm test:memory:vector      # Vector memory tests
pnpm test:memory:dual       # Dual database tests
pnpm test:memory:episodic   # EpisodicMemory tests
```

## Test Suites

### Vector Memory Tests

**File:** `vector-memory.integration.test.ts`

Tests:
- Embedding storage and retrieval
- Memory CRUD operations
- Vector similarity search
- Filtering by siteId, agentId, type
- Embedding conversion verification

**Requirements:**
- `DATABASE_URL` (Supabase)
- `OPENAI_API_KEY`

### Dual Database Tests

**File:** `dual-database.integration.test.ts`

Tests:
- Client separation (REST vs Vector)
- Schema separation
- Database operation isolation
- Connection string validation

**Requirements:**
- `DATABASE_URL` (Supabase)
- `POSTGRES_URL` (NeonDB)

### EpisodicMemory Tests

**File:** `episodic-memory.integration.test.ts`

Tests:
- EpisodicMemory → VectorMemoryService integration
- Memory operations delegation
- CRDT state management
- End-to-end memory flow

**Requirements:**
- `DATABASE_URL` (Supabase)
- `POSTGRES_URL` (NeonDB)
- `OPENAI_API_KEY`

## Test Structure

Each test suite:
1. Sets up test data
2. Runs test operations
3. Verifies results
4. Cleans up test data

Test data uses unique IDs (timestamp-based) to avoid conflicts.

## Troubleshooting

### "DATABASE_URL must be set"

**Solution:** Set the `DATABASE_URL` environment variable to your Supabase connection string.

```bash
export DATABASE_URL="postgresql://..."
```

Or create a `.env.test` file (see `env.test.example`).

### "pgvector extension not installed"

**Solution:** Run the setup script:

```bash
pnpm test:memory:setup
```

Or manually run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### "agent_memories table does not exist"

**Solution:** Run the migration:

```bash
pnpm test:memory:setup
```

Or manually run the SQL from `packages/db/migrations/supabase-vector-setup.sql`.

### "Connection failed"

**Possible causes:**
- Connection string is incorrect
- Database is not accessible
- Network/firewall issues
- Database credentials are wrong

**Solution:**
1. Verify connection string format
2. Test connection manually (psql, Drizzle Studio, etc.)
3. Check database is running and accessible
4. Verify credentials

### "OpenAI API key invalid"

**Solution:**
1. Check API key is correct
2. Verify API key has embedding permissions
3. Check account has credits/quota
4. Verify network can reach OpenAI API

### Tests fail with "timeout"

**Possible causes:**
- Database is slow
- Network latency
- OpenAI API is slow

**Solution:**
1. Increase test timeout in test file
2. Check database performance
3. Verify network connection

### Test data not cleaned up

**Solution:**
- Tests should clean up automatically
- If cleanup fails, manually delete test data:
  ```sql
  DELETE FROM agent_memories WHERE id LIKE 'test-mem-%';
  ```

## Expected Test Output

### Successful Run

```
🧪 Running: All Memory Integration Tests

✅ Vector Memory Integration
  ✅ Embedding Storage and Retrieval
    ✅ should create a memory with embedding
    ✅ should retrieve a memory by ID
    ...
  ✅ Vector Similarity Search
    ✅ should find similar memories
    ...

✅ Dual Database Integration
  ✅ Client Separation
    ✅ should return separate client instances
    ...

✅ EpisodicMemory Integration
  ✅ Memory Operations
    ✅ should add memory using VectorMemoryService
    ...

Test Files  3 passed (3)
Tests  15 passed (15)
```

### Failed Run

```
❌ Vector Memory Integration
  ❌ Embedding Storage and Retrieval
    ❌ should create a memory with embedding
      Error: Connection failed
```

## Manual Testing

You can also test manually using the database clients:

```typescript
import { getVectorClient } from '@revealui/db/client'
import { VectorMemoryService } from '@revealui/ai/memory/vector'

const service = new VectorMemoryService()
const memory = await service.create({...})
```

## CI/CD Integration

For CI/CD, set environment variables as secrets:

```yaml
# Example GitHub Actions
env:
  DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
  POSTGRES_URL: ${{ secrets.NEON_DATABASE_URL }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Performance Notes

- Vector similarity search uses HNSW indexes (fast)
- Tests create/delete data (may be slow on first run)
- OpenAI API calls add latency (embedding generation)
- Use staging databases for testing (not production)

## Security Notes

- Never commit `.env.test` with real credentials
- Use test/staging databases, not production
- Rotate API keys regularly
- Use environment-specific connection strings
- Consider using secrets management in CI/CD

## Additional Resources

- [Vector Memory Service Documentation](../../../../ai/src/memory/vector/README.md)
- [Dual Database Architecture](../../../../docs/architecture/DUAL_DATABASE_ARCHITECTURE.md)
- [Supabase pgvector Documentation](https://supabase.com/docs/guides/database/extensions/pgvector)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
