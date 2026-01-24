# Database Connection Setup Guide

**Date:** 2025-01-16  
**Status:** Documentation Complete  
**Purpose:** Guide for setting up database connections for integration tests

---

## Overview

Integration tests require two database connections:
1. **Supabase (Vector Database)** - For vector search operations (`agent_memories` table)
2. **NeonDB (REST Database)** - For transactional REST API operations

---

## Required Environment Variables

### 1. DATABASE_URL (Supabase)
- **Purpose:** Vector database connection (Supabase)
- **Format:** `postgresql://user:password@host:port/database`
- **Recommended Port:** 6543 (Transaction Pooling mode)
- **Where to Get:**
  1. Go to https://supabase.com/dashboard
  2. Select your project
  3. Settings > Database
  4. Copy "Connection string" (use Transaction Pooling mode)

**Example:**
```bash
export DATABASE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:6543/postgres"
```

### 2. POSTGRES_URL (NeonDB)
- **Purpose:** REST database connection (NeonDB)
- **Format:** `postgresql://user:password@host:port/database`
- **Where to Get:**
  1. Go to https://console.neon.tech
  2. Select your project
  3. Connection Details
  4. Copy connection string

**Example:**
```bash
export POSTGRES_URL="postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb"
```

### 3. OPENAI_API_KEY
- **Purpose:** Generate embeddings for vector search tests
- **Where to Get:**
  1. Go to https://platform.openai.com/api-keys
  2. Create new secret key
  3. Copy the key (you won't see it again!)

**Example:**
```bash
export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## Setup Instructions

### Option 1: Environment Variables (Recommended)

```bash
# Set environment variables
export DATABASE_URL="your-supabase-connection-string"
export POSTGRES_URL="your-neon-connection-string"
export OPENAI_API_KEY="your-openai-api-key"

# Verify setup
pnpm --filter test test:memory:verify
```

### Option 2: .env.test File

```bash
# Copy example file
cp packages/test/env.test.example packages/test/.env.test

# Edit with your actual values
# (Use your preferred editor)

# Load environment variables
source packages/test/.env.test

# Verify setup
pnpm --filter test test:memory:verify
```

### Option 3: .env File (Root)

If you have a `.env` file in the project root, you can add:

```bash
DATABASE_URL=your-supabase-connection-string
POSTGRES_URL=your-neon-connection-string
OPENAI_API_KEY=your-openai-api-key
```

---

## Verification Steps

### 1. Verify Environment Variables

```bash
pnpm --filter test test:memory:verify
```

This will check:
- ✅ Environment variables are set
- ✅ Connection string format is valid
- ✅ Database connections work
- ✅ Schema is correct
- ✅ pgvector extension is installed
- ✅ Indexes exist

### 2. Setup Database (if needed)

If the verification shows the database needs setup:

```bash
pnpm --filter test test:memory:setup
```

This will:
- Enable pgvector extension
- Create `agent_memories` table
- Create HNSW indexes

### 3. Run Tests

Once setup is complete:

```bash
# Run all memory tests
pnpm --filter test test:memory:all

# Or run specific test suites
pnpm --filter test test:memory:vector      # Vector memory tests
pnpm --filter test test:memory:dual       # Dual database tests
pnpm --filter test test:memory:episodic   # EpisodicMemory tests
```

---

## Troubleshooting

### Error: "DATABASE_URL must be set"

**Solution:** Set the `DATABASE_URL` environment variable:
```bash
export DATABASE_URL="your-supabase-connection-string"
```

### Error: "POSTGRES_URL must be set"

**Solution:** Set the `POSTGRES_URL` environment variable:
```bash
export POSTGRES_URL="your-neon-connection-string"
```

### Error: "ENOTFOUND api.pooler.supabase.com"

**Possible Causes:**
1. Network connectivity issue
2. DNS resolution problem
3. Incorrect connection string
4. Database not accessible from your network

**Solutions:**
1. Check your internet connection
2. Verify the connection string is correct
3. Try using the direct connection port (5432) instead of pooling port (6543)
4. Check if your IP is whitelisted in Supabase dashboard
5. Try connecting from a different network

### Error: "Connection refused"

**Possible Causes:**
1. Database is not running
2. Firewall blocking connection
3. Incorrect port number
4. Database credentials are wrong

**Solutions:**
1. Verify database is running and accessible
2. Check firewall settings
3. Verify port number in connection string
4. Double-check credentials

### Error: "pgvector extension not found"

**Solution:** Run the setup script:
```bash
pnpm --filter test test:memory:setup
```

This will install the pgvector extension if it's not already installed.

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env.test` or `.env` files** with real credentials
2. **Use staging/test databases**, not production
3. **Rotate API keys regularly**
4. **Use environment-specific connection strings**
5. **Consider using secrets management** in CI/CD (GitHub Secrets, etc.)

---

## CI/CD Setup

For GitHub Actions or other CI/CD platforms:

```yaml
env:
  DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
  POSTGRES_URL: ${{ secrets.NEON_DATABASE_URL }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Add these as secrets in your repository settings.

---

## Next Steps

Once database connections are configured:

1. ✅ Run verification: `pnpm --filter test test:memory:verify`
2. ✅ Setup database (if needed): `pnpm --filter test test:memory:setup`
3. ✅ Run integration tests: `pnpm --filter test test:memory:all`
4. ✅ Document test results

---

**Last Updated:** 2026-01-16  
**Status:** Ready for use
