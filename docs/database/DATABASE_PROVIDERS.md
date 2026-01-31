# Database Provider Reference

This document provides provider-specific configuration and troubleshooting for database services used in RevealUI.

---

## Table of Contents

- [ElectricSQL Setup](#electricsql-setup)
- [Supabase Networking](#supabase-networking)

---

## ElectricSQL Setup

### ElectricSQL Electrification Migrations

This section documents the SQL migrations needed to electrify tables for sync with ElectricSQL.

**What is Electrification?**
- Enables tables to be synchronized to client applications
- Each table needs to be explicitly electrified with appropriate sync rules
- Should be run via ElectricSQL CLI or service after setting up the service

### Electrification Commands

```sql
-- Electrify agent_contexts table
-- Syncs contexts filtered by agent_id and optional session_id
ALTER TABLE agent_contexts ENABLE ELECTRIC;

-- Electrify agent_memories table
-- Syncs memories filtered by agent_id and optional site_id
ALTER TABLE agent_memories ENABLE ELECTRIC;

-- Electrify conversations table
-- Syncs conversations filtered by user_id and optional agent_id
ALTER TABLE conversations ENABLE ELECTRIC;

-- Electrify agent_actions table
-- Syncs actions filtered by agent_id and optional conversation_id
ALTER TABLE agent_actions ENABLE ELECTRIC;
```

### Row Level Security (RLS) Policies

Row Level Security policies should be configured in PostgreSQL to enforce data filtering at the database level. The sync shapes in the client code (`packages/sync/src/sync/shapes.ts`) work in conjunction with RLS policies to ensure only authorized data is synced.

**Example RLS policies** (should be created in your database migrations):

```sql
-- Agent contexts policy
CREATE POLICY sync_agent_contexts_policy ON agent_contexts
  FOR SELECT
  USING (
    agent_id = current_setting('app.agent_id', true)::text
    AND (
      session_id = current_setting('app.session_id', true)::text
      OR current_setting('app.session_id', true) IS NULL
    )
  );

-- Agent memories policy
CREATE POLICY sync_agent_memories_policy ON agent_memories
  FOR SELECT
  USING (
    agent_id = current_setting('app.agent_id', true)::text
    AND (
      site_id = current_setting('app.site_id', true)::text
      OR current_setting('app.site_id', true) IS NULL
    )
  );

-- Conversations policy
CREATE POLICY sync_conversations_policy ON conversations
  FOR SELECT
  USING (
    user_id = current_setting('app.user_id', true)::text
    AND (
      agent_id = current_setting('app.agent_id', true)::text
      OR current_setting('app.agent_id', true) IS NULL
    )
  );

-- Agent actions policy
CREATE POLICY sync_agent_actions_policy ON agent_actions
  FOR SELECT
  USING (
    agent_id = current_setting('app.agent_id', true)::text
    AND (
      conversation_id = current_setting('app.conversation_id', true)::text
      OR current_setting('app.conversation_id', true) IS NULL
    )
  );
```

---

## Supabase Networking

### IPv4/IPv6 Compatibility

Supabase databases use **IPv6 addresses by default**. This section explains what this means and when you might need the IPv4 add-on.

### Understanding the Protocols

- **IPv6**: Modern internet protocol (most modern networks support it)
- **IPv4**: Older internet protocol (still widely used, especially in corporate networks)

### Do You Need the IPv4 Add-On?

#### ✅ You Probably DON'T Need It If:

1. You're on a modern network (most home/office networks support IPv6)
2. Your development environment works (if connections are working, you're fine)
3. You're using Supabase's Session Pooler (which handles IPv4/IPv6 automatically)

#### ⚠️ You MIGHT Need It If:

1. You're on a corporate network that blocks IPv6
2. You're getting connection errors when trying to connect
3. You're deploying to a server that only supports IPv4
4. You're using direct database connections (not Session Pooler)

### Session Pooler (Recommended)

**Session Pooler** is Supabase's connection pooling service that:
- ✅ Handles IPv4/IPv6 compatibility automatically
- ✅ Provides better connection management
- ✅ Is **free** to use
- ✅ Uses a different connection string format

**Standard connection string:**
```
postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

**Session Pooler connection string:**
```
postgresql://postgres:password@db.xxx.supabase.co:6543/postgres
```

Notice: Port **6543** instead of **5432** (this is the Session Pooler port)

### For MCP Server Setup

#### ✅ Recommended: Use Session Pooler (Free)

For the Supabase MCP server, you typically use:
- `SUPABASE_URL` - Your project URL (e.g., `https://xxx.supabase.co`)
- `SUPABASE_ANON_KEY` - Your anon/public key

These work with **both IPv4 and IPv6** - no add-on needed!

#### When You'd Need IPv4 Add-On

Only if you're:
- Using direct PostgreSQL connections (not Supabase client)
- On a network that blocks IPv6
- Getting connection errors

### Cost Comparison

- **Session Pooler**: ✅ **FREE** (recommended)
- **IPv4 Add-On**: 💰 **~$4/month** (only if needed)

### Recommendation

**For MCP servers**: You don't need the IPv4 add-on. The Supabase MCP server uses the Supabase client library which works with both IPv4 and IPv6 automatically.

**Only enable IPv4 add-on if:**
- You're getting actual connection errors
- You're on a network that blocks IPv6
- You need direct PostgreSQL connections

### How to Check If You Need It

1. **Test your connection**:
   ```bash
   # Try connecting to your Supabase project
   # If it works, you don't need IPv4 add-on
   ```

2. **Check your network**:
   - Most modern networks support both IPv4 and IPv6
   - Corporate networks sometimes block IPv6

3. **Monitor for errors**:
   - If you see connection errors, then consider the add-on
   - If everything works, you're fine!

### Summary

- The message is informational - not necessarily a problem
- For MCP servers: You likely don't need IPv4 add-on
- Use Session Pooler if you need direct database access (it's free)
- Only pay for IPv4 add-on if you have actual connection issues

---

## Related Documentation

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Database setup and configuration
- [DATABASE_TYPES.md](./DATABASE_TYPES.md) - TypeScript type generation
- [DATABASE_MIGRATION_PLAN.md](./DATABASE_MIGRATION_PLAN.md) - Migration strategies
- [DATABASE_PROVIDER_SWITCHING.md](./DATABASE_PROVIDER_SWITCHING.md) - Switching between providers
