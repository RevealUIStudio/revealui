# Supabase IPv4/IPv6 Compatibility Explained

## What This Means

Supabase databases use **IPv6 addresses by default**. The message you're seeing means:

- **IPv6**: Modern internet protocol (most modern networks support it)
- **IPv4**: Older internet protocol (still widely used, especially in corporate networks)

## Do You Need to Worry?

### ✅ **You Probably DON'T Need the IPv4 Add-On If:**

1. **You're on a modern network** (most home/office networks support IPv6)
2. **Your development environment works** (if connections are working, you're fine)
3. **You're using Supabase's Session Pooler** (which handles IPv4/IPv6 automatically)

### ⚠️ **You MIGHT Need IPv4 Add-On If:**

1. **You're on a corporate network** that blocks IPv6
2. **You're getting connection errors** when trying to connect
3. **You're deploying to a server** that only supports IPv4
4. **You're using direct database connections** (not Session Pooler)

## What is Session Pooler?

**Session Pooler** is Supabase's connection pooling service that:
- ✅ Handles IPv4/IPv6 compatibility automatically
- ✅ Provides better connection management
- ✅ Is **free** to use
- ✅ Uses a different connection string format

### Session Pooler Connection String Format

Instead of:
```
postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

Use:
```
postgresql://postgres:password@db.xxx.supabase.co:6543/postgres
```

Notice: Port **6543** instead of **5432** (this is the Session Pooler port)

## For Your MCP Server Setup

### ✅ **Recommended: Use Session Pooler (Free)**

For the Supabase MCP server, you typically use:
- `SUPABASE_URL` - Your project URL (e.g., `https://xxx.supabase.co`)
- `SUPABASE_ANON_KEY` - Your anon/public key

These work with **both IPv4 and IPv6** - no add-on needed!

### When You'd Need IPv4 Add-On

Only if you're:
- Using direct PostgreSQL connections (not Supabase client)
- On a network that blocks IPv6
- Getting connection errors

## Cost

- **Session Pooler**: ✅ **FREE** (recommended)
- **IPv4 Add-On**: 💰 **~$4/month** (only if needed)

## Recommendation

**For MCP servers**: You don't need the IPv4 add-on. The Supabase MCP server uses the Supabase client library which works with both IPv4 and IPv6 automatically.

**Only enable IPv4 add-on if:**
- You're getting actual connection errors
- You're on a network that blocks IPv6
- You need direct PostgreSQL connections

## How to Check If You Need It

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

## Summary

- **The message is informational** - not necessarily a problem
- **For MCP servers**: You likely don't need IPv4 add-on
- **Use Session Pooler** if you need direct database access (it's free)
- **Only pay for IPv4 add-on** if you have actual connection issues
