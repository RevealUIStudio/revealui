# ElectricSQL Setup Guide for RevealUI

Complete step-by-step guide to set up ElectricSQL for agent memory sharing.

## Prerequisites

- PostgreSQL database (NeonDB) with agent tables
- Node.js 18+ or 20+
- pnpm installed
- ElectricSQL CLI access

## Step 1: Install ElectricSQL Service

### Option A: Self-Hosted (Recommended)

1. **Install ElectricSQL CLI:**
   ```bash
   npm install -g @electric-sql/cli
   ```

2. **Initialize ElectricSQL in your project:**
   ```bash
   cd /home/joshua-v-dev/projects/RevealUI
   npx @electric-sql/cli init
   ```

3. **Configure ElectricSQL:**
   Create `electric.config.ts` in project root:
   ```typescript
   export default {
     service: {
       host: 'localhost',
       port: 5133,
     },
     proxy: {
       port: 65432,
     },
     database: {
       host: process.env.DATABASE_URL,
     },
   }
   ```

### Option B: Docker (Alternative)

```bash
docker run -d \
  --name electric-sql \
  -p 5133:5133 \
  -e DATABASE_URL=$DATABASE_URL \
  electricsql/electric:latest
```

## Step 2: Configure PostgreSQL for ElectricSQL

ElectricSQL requires specific PostgreSQL setup:

1. **Enable required extensions:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   ```

2. **Add ElectricSQL metadata tables:**
   ElectricSQL will create these automatically, but ensure your database user has permissions.

3. **Verify agent tables exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('agent_contexts', 'agent_memories', 'conversations');
   ```

## Step 3: Generate ElectricSQL Client

1. **Start the ElectricSQL service first** (see Step 6 below), then run schema generation:
   ```bash
   pnpm electric:generate
   # Or manually:
   pnpm dlx electric-sql generate
   ```

   This will:
   - Connect to your PostgreSQL database via ElectricSQL service
   - Read your PostgreSQL schema
   - Generate TypeScript types
   - Create `.electric/` directory with config
   - Generate client code

2. **Verify generated files:**
   ```
   .electric/
   ├── @config.ts          # ElectricSQL configuration (generated)
   ├── client/              # Generated client code
   └── migrations/          # Schema migrations
   ```

   **Note**: The `.electric/` directory is git-ignored. Generated files should not be committed.

## Step 4: Package Implementation

The package implementation is already complete! The following files are ready:

- ✅ `packages/sync/src/client/index.ts` - Client initialization with `createElectricClient()`
- ✅ `packages/sync/src/provider/ElectricProvider.tsx` - React provider component
- ✅ `packages/sync/src/hooks/useAgentContext.ts` - Live query hook for contexts
- ✅ `packages/sync/src/hooks/useAgentMemory.ts` - Live query hook for memories
- ✅ `packages/sync/src/hooks/useConversations.ts` - Live query hook for conversations

The implementation automatically uses generated types when available, and falls back to manual types if not yet generated.

## Step 5: Configure Environment Variables

Add to `.env`:

```env
# ElectricSQL Service
ELECTRIC_SERVICE_URL=http://localhost:5133
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133

# PostgreSQL (already configured)
DATABASE_URL=postgresql://...
```

## Step 6: Start ElectricSQL Service

**Option A: Using Docker (Recommended)**

```bash
# Start the service
pnpm electric:service:start
# Or manually:
docker-compose -f docker-compose.electric.yml up -d

# View logs
pnpm electric:service:logs
# Or manually:
docker-compose -f docker-compose.electric.yml logs -f

# Stop the service
pnpm electric:service:stop
# Or manually:
docker-compose -f docker-compose.electric.yml down
```

**Option B: Self-Hosted**

```bash
# Install CLI globally
npm install -g @electric-sql/cli

# Start the service
npx @electric-sql/cli start
```

**Verify it's running:**
```bash
curl http://localhost:5133/health
```

You should see a successful response indicating the service is healthy.

## Step 7: Electrify Tables

Electrify the agent tables in your PostgreSQL database. This enables them for sync:

```sql
-- Run these SQL commands in your PostgreSQL database
ALTER TABLE agent_contexts ENABLE ELECTRIC;
ALTER TABLE agent_memories ENABLE ELECTRIC;
ALTER TABLE conversations ENABLE ELECTRIC;
ALTER TABLE agent_actions ENABLE ELECTRIC;
```

See `electric.migrations.sql` for the complete migration script and example Row Level Security (RLS) policies.

**Note**: Sync filtering is handled via:
1. **Sync shapes** in the client code (`packages/sync/src/sync/shapes.ts`)
2. **RLS policies** in PostgreSQL (optional, for additional security)
3. **Client-side filtering** in the hooks

## Step 8: Integrate into Apps

### CMS App

Update `apps/cms/src/lib/providers/index.tsx`:

```tsx
import { ElectricProvider } from '@revealui/sync/provider'

export const Providers = ({ children }) => {
  return (
    <ElectricProvider serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}>
      <ThemeProvider>
        <HeaderThemeProvider>{children}</HeaderThemeProvider>
      </ThemeProvider>
    </ElectricProvider>
  )
}
```

### Web App

Update app entry point (e.g., `apps/web/src/main.tsx`):

```tsx
import { ElectricProvider } from '@revealui/sync/provider'

function App() {
  return (
    <ElectricProvider serviceUrl={import.meta.env.VITE_ELECTRIC_SERVICE_URL}>
      <YourApp />
    </ElectricProvider>
  )
}
```

## Step 9: Test the Integration

1. **Start ElectricSQL service:**
   ```bash
   npx @electric-sql/cli start
   ```

2. **Start your apps:**
   ```bash
   pnpm dev
   ```

3. **Test cross-tab sync:**
   - Open app in two browser tabs
   - Create agent context in one tab
   - Verify it appears in the other tab

## Troubleshooting

### Service Won't Start

- Check PostgreSQL connection: `psql $DATABASE_URL`
- Verify port 5133 is available: `lsof -i :5133`
- Check ElectricSQL logs

### Schema Generation Fails

- Ensure PostgreSQL user has CREATE privileges
- Verify all agent tables exist
- Check ElectricSQL can connect to database

### Sync Not Working

- Verify ElectricSQL service is running
- Check browser console for errors
- Verify environment variables are set
- Check network tab for sync requests

## Next Steps

After setup is complete:

1. Update hooks to use generated query API
2. Implement real-time queries
3. Add error handling
4. Add loading states
5. Test cross-tab sync thoroughly

## Testing & Validation

- **[ElectricSQL Testing Results](../TESTING_RESULTS.md)** - Detailed testing results and critical findings
- **[ElectricSQL Testing Summary](../TESTING_SUMMARY.md)** - Quick summary of testing status and blockers

## Resources

- [ElectricSQL Documentation](https://electric-sql.com/docs)
- [ElectricSQL GitHub](https://github.com/electric-sql/electric)
- [ElectricSQL Discord](https://discord.gg/electric-sql)
