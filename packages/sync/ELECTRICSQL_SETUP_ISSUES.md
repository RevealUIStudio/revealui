# ElectricSQL Setup Issues & Solutions

## Issue 1: Docker Compose Command ✅ FIXED

**Problem**: `docker-compose: not found`

**Solution**: Updated package.json to use `docker compose` (space) instead of `docker-compose` (hyphen)

**Status**: ✅ Fixed

## Issue 2: PostgreSQL WAL Level ❌ NEEDS FIX

**Problem**: ElectricSQL service crashes with error:
```
Electric requires wal_level >= logical. 
See https://electric-sql.com/docs/guides/deployment#_1-running-postgres
```

**Root Cause**: PostgreSQL database doesn't have logical replication enabled.

**Solution**: Configure PostgreSQL with `wal_level = logical`

### For Local PostgreSQL

1. **Edit postgresql.conf**:
   ```conf
   wal_level = logical
   max_replication_slots = 10
   max_wal_senders = 10
   ```

2. **Restart PostgreSQL**:
   ```bash
   sudo systemctl restart postgresql
   # OR
   sudo service postgresql restart
   ```

3. **Verify**:
   ```sql
   SHOW wal_level;
   -- Should return: logical
   ```

### For Managed PostgreSQL (Neon, Supabase, etc.)

**Neon**:
- ✅ Logical replication is enabled by default
- No configuration needed

**Supabase**:
- ✅ Logical replication is enabled by default
- No configuration needed

**Other Providers**:
- Check provider documentation
- May need to enable logical replication in provider settings

### For Docker PostgreSQL

If using Docker for PostgreSQL, add to your docker-compose.yml:

```yaml
services:
  postgres:
    image: postgres:16
    command: postgres -c wal_level=logical -c max_replication_slots=10 -c max_wal_senders=10
    # ... rest of config
```

## Issue 3: DATABASE_URL Not Set ⚠️ WARNING

**Problem**: Docker Compose warning:
```
The "DATABASE_URL" variable is not set. Defaulting to a blank string.
```

**Solution**: Set `DATABASE_URL` or `POSTGRES_URL` in `.env` file:

```bash
POSTGRES_URL=postgresql://user:password@host:5432/database
# OR
DATABASE_URL=postgresql://user:password@host:5432/database
```

**Note**: ElectricSQL will use this to connect to PostgreSQL.

## Verification Steps

### 1. Check PostgreSQL WAL Level

```sql
-- Connect to your PostgreSQL database
psql $POSTGRES_URL

-- Check WAL level
SHOW wal_level;
-- Should return: logical

-- If not logical, you need to configure it
```

### 2. Check ElectricSQL Service

```bash
# Check service status
docker ps --filter "name=electric"

# Check logs
docker logs revealui-electric-sql --tail 50

# Check health
curl http://localhost:5133/health
```

### 3. Verify Database Connection

```bash
# Test PostgreSQL connection
psql $POSTGRES_URL -c "SELECT version();"

# Check if ElectricSQL can connect
docker logs revealui-electric-sql | grep -i "database\|connection\|postgres"
```

## Quick Fix Checklist

- [ ] ✅ Fixed docker-compose command (done)
- [ ] ⏸️ Configure PostgreSQL wal_level = logical
- [ ] ⏸️ Set DATABASE_URL in .env
- [ ] ⏸️ Restart ElectricSQL service
- [ ] ⏸️ Verify service health endpoint

## Next Steps

1. **Configure PostgreSQL** with logical replication
2. **Set DATABASE_URL** in .env file
3. **Restart ElectricSQL service**:
   ```bash
   pnpm electric:service:stop
   pnpm electric:service:start
   ```
4. **Verify service is running**:
   ```bash
   curl http://localhost:5133/health
   ```
5. **Run tests** once service is healthy

## References

- ElectricSQL Deployment Guide: https://electric-sql.com/docs/guides/deployment
- PostgreSQL Logical Replication: https://www.postgresql.org/docs/current/logical-replication.html
