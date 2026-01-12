# Large-Scale JSON Fields Solution Analysis

**Date**: January 2025  
**Context**: Large-scale application requiring queryable, indexable JSON fields  
**Requirement**: Must support efficient queries by `roles`, `tenants`, and other JSON fields

---

## 🎯 Requirements for Large-Scale App

### Query Patterns (From Codebase Analysis)

1. **Role-Based Access Control**:
   ```typescript
   // From hasRole.ts - frequently queried
   hasRole(user, ['admin', 'super-admin'])
   // Need to efficiently check if user.roles array contains role
   ```

2. **Tenant-Scoped Queries**:
   ```typescript
   // Need to filter users by tenant
   // Need to check tenant relationships
   // Need to query by tenant roles
   ```

3. **Multi-Tenant Filtering**:
   ```typescript
   // Need to find all users for a specific tenant
   // Need to filter by tenant + role combinations
   ```

### Performance Requirements

- ✅ **Indexed queries** - Must support fast lookups
- ✅ **WHERE clause support** - Must query JSON fields in SQL
- ✅ **Scalability** - Must handle 10,000+ users efficiently
- ✅ **Concurrent updates** - Must handle high write volume
- ✅ **Multi-database** - Must work with SQLite (dev) and PostgreSQL (prod)

---

## 📊 Solution Comparison for Large-Scale

### Option 1: JSONB Column (PostgreSQL) + TEXT (SQLite) ✅ **RECOMMENDED**

**Architecture**:
- **PostgreSQL**: Use JSONB column (native JSON with indexing)
- **SQLite**: Use TEXT column (with JSON functions)
- **Adapter-specific**: Different column types per database

#### Implementation

**PostgreSQL Schema**:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  password TEXT,
  _json JSONB DEFAULT '{}'::jsonb
);

-- Create GIN index for JSONB queries
CREATE INDEX idx_users_json_roles ON users USING GIN ((_json->'roles'));
CREATE INDEX idx_users_json_tenants ON users USING GIN ((_json->'tenants'));
```

**SQLite Schema**:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  password TEXT,
  _json TEXT DEFAULT '{}'
);

-- SQLite doesn't support JSON indexes efficiently
-- But JSON functions available for querying
```

#### Pros ✅

1. **Native JSON Support (PostgreSQL)**
   - ✅ JSONB with indexing (GIN indexes)
   - ✅ Fast queries: `WHERE _json @> '{"roles": ["admin"]}'`
   - ✅ Indexed lookups (sub-millisecond)
   - ✅ JSON operators (`@>`, `->`, `->>`)
   - ✅ Efficient storage (binary format)

2. **Query Performance**
   ```sql
   -- PostgreSQL: Fast indexed query
   SELECT * FROM users 
   WHERE _json @> '{"roles": ["user-admin"]}'::jsonb;
   -- Uses GIN index, fast even with 100k+ rows
   ```

3. **Indexing Support**
   ```sql
   -- Multiple indexes possible
   CREATE INDEX idx_users_roles ON users USING GIN ((_json->'roles'));
   CREATE INDEX idx_users_tenants ON users USING GIN ((_json->'tenants'));
   CREATE INDEX idx_users_tenant_roles ON users USING GIN ((_json->'tenants'->'roles'));
   ```

4. **WHERE Clause Support**
   ```typescript
   // This WILL work with JSONB:
   revealui.find({
     collection: 'users',
     where: {
       _json: {
         contains: { roles: ['user-admin'] }  // JSONB operator
       }
     }
   })
   ```

5. **Works with Both Databases**
   - PostgreSQL: JSONB (optimal)
   - SQLite: TEXT (functional, less optimal)

#### Cons ❌

1. **Adapter Complexity**
   - Need adapter-specific schema creation
   - Need adapter-specific query building
   - More code complexity

2. **SQLite Limitations**
   - TEXT column (no native JSONB)
   - Limited indexing (can use functional indexes, but less efficient)
   - JSON functions available, but slower than JSONB

3. **Query Builder Complexity**
   - Need to handle JSONB operators for PostgreSQL
   - Need to handle JSON functions for SQLite
   - More complex WHERE clause building

#### Complexity: **MEDIUM-HIGH** (4-6 hours)

---

### Option 2: Hybrid Approach (Frequently-Queried as Columns) ✅ **STRONG CANDIDATE**

**Architecture**:
- Store **frequently-queried fields** as actual columns
- Store **rarely-queried fields** in `_json` TEXT column
- **Decision**: `roles` and `tenants` become columns, other JSON stays in `_json`

#### Implementation

**Schema (Both Databases)**:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  password TEXT,
  roles TEXT,           -- Store as TEXT (JSON string), can index
  tenants TEXT,         -- Store as TEXT (JSON string), can index
  _json TEXT DEFAULT '{}'  -- Other JSON fields (metadata, etc.)
);

-- PostgreSQL: Create indexes
CREATE INDEX idx_users_roles ON users USING GIN (roles::jsonb);
CREATE INDEX idx_users_tenants ON users USING GIN (tenants::jsonb);

-- SQLite: Functional indexes (less efficient)
CREATE INDEX idx_users_roles ON users(json_extract(roles, '$'));
```

#### Pros ✅

1. **Queryable Fields**
   - ✅ `roles` can be queried: `WHERE roles @> '["admin"]'`
   - ✅ `tenants` can be queried: `WHERE tenants @> '[{"tenant": "1"}]'`
   - ✅ Indexed lookups possible

2. **Balanced Approach**
   - ✅ Important fields: Columns (queryable, indexable)
   - ✅ Less important fields: JSON column (flexible)

3. **Works with Both Databases**
   - PostgreSQL: JSONB cast or TEXT with JSON functions
   - SQLite: TEXT with JSON functions

4. **Future-Proof**
   - Can migrate individual fields to columns as needed
   - Can add indexes to important fields
   - Flexible evolution

#### Cons ❌

1. **Schema Changes**
   - Need to add `roles` and `tenants` columns
   - Migration for existing data
   - More columns to manage

2. **Dual Storage**
   - Some fields in columns, others in JSON
   - More complex INSERT/UPDATE logic
   - Potential for inconsistency

3. **Index Complexity**
   - Need indexes on multiple columns
   - PostgreSQL: JSONB indexes on TEXT columns (cast needed)
   - SQLite: Functional indexes (less efficient)

#### Complexity: **HIGH** (6-8 hours)

---

### Option 3: Normalized Tables (Junction Tables) ❌ **NOT RECOMMENDED**

**Architecture**:
- Store arrays in separate junction tables
- `user_roles` table, `user_tenants` table
- JOIN queries for relationships

#### Implementation

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  password TEXT
);

CREATE TABLE user_roles (
  user_id TEXT,
  role TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_tenants (
  user_id TEXT,
  tenant_id TEXT,
  roles TEXT,  -- JSON array of tenant roles
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

#### Pros ✅

1. **Perfect Normalization**
   - ✅ Proper relational structure
   - ✅ Excellent query performance
   - ✅ Full indexing support
   - ✅ Foreign key constraints

2. **Query Performance**
   ```sql
   -- Fast JOIN query
   SELECT u.* FROM users u
   JOIN user_roles ur ON u.id = ur.user_id
   WHERE ur.role = 'admin';
   ```

#### Cons ❌

1. **Very High Complexity**
   - ❌ Major architectural change
   - ❌ Multiple tables to manage
   - ❌ Complex JOIN queries
   - ❌ Relationship management system needed

2. **Breaking Changes**
   - ❌ Requires rewriting query builder
   - ❌ Requires relationship system
   - ❌ Major refactoring

3. **Over-Engineering**
   - ❌ Too complex for JSON arrays
   - ❌ More maintenance burden
   - ❌ Slower development velocity

#### Complexity: **VERY HIGH** (1-2 weeks)

---

## 🎯 Recommendation: JSONB Column (PostgreSQL) + TEXT (SQLite)

### Why JSONB for Large-Scale?

1. **Query Performance** ✅
   - Indexed queries (GIN indexes)
   - Sub-millisecond lookups even with 100k+ rows
   - Native JSON operators

2. **Indexing Support** ✅
   ```sql
   -- Fast indexed queries
   CREATE INDEX idx_users_roles ON users USING GIN ((_json->'roles'));
   ```

3. **WHERE Clause Support** ✅
   ```sql
   -- PostgreSQL JSONB operators
   WHERE _json @> '{"roles": ["admin"]}'::jsonb
   ```

4. **Scalability** ✅
   - Handles 100k+ rows efficiently
   - Indexed queries scale well
   - Binary storage (efficient)

5. **Multi-Database Support** ✅
   - PostgreSQL: JSONB (optimal)
   - SQLite: TEXT (functional, acceptable for dev)

### Implementation Strategy

#### Phase 1: Schema Creation (Adapter-Specific)

```typescript
// sqlite.ts
case 'jsonb':  // Treat as TEXT in SQLite
  columnDef += ' TEXT'
  break

// universal-postgres.ts
// No schema creation in adapter (handled by migrations)
// But document JSONB column type
```

#### Phase 2: Query Building (JSONB Operators)

```typescript
// Query builder needs JSONB operator support
if (parameterStyle === 'postgres' && field.type === 'jsonb') {
  // Use JSONB operators: @>, ->, ->>
  whereClause = `_json @> $${paramIndex}::jsonb`
}
```

#### Phase 3: INSERT/UPDATE Logic

```typescript
// Serialize JSON fields
const jsonData = { roles, tenants, ...otherJsonFields }
const jsonValue = JSON.stringify(jsonData)

// PostgreSQL: Insert as JSONB
// SQLite: Insert as TEXT
await db.query(
  `INSERT INTO users (id, email, _json) VALUES ($1, $2, $3)`,
  [id, email, jsonValue]
)
```

#### Phase 4: SELECT Deserialization

```typescript
// PostgreSQL: Already JSONB, parse to object
// SQLite: TEXT, parse JSON string
const jsonFields = typeof row._json === 'string' 
  ? JSON.parse(row._json)
  : row._json  // Already object (JSONB)
```

---

## 📊 Comparison Matrix

| Criteria | JSONB (PostgreSQL) + TEXT (SQLite) | Hybrid (Columns + JSON) | Normalized Tables |
|----------|-----------------------------------|------------------------|-------------------|
| **Query Performance** | ✅ Excellent (indexed) | ✅ Good (indexed columns) | ✅ Excellent (JOINs) |
| **WHERE Clause Support** | ✅ Yes (JSONB operators) | ✅ Yes (column queries) | ✅ Yes (JOIN queries) |
| **Indexing** | ✅ GIN indexes | ✅ Column indexes | ✅ Standard indexes |
| **Scalability** | ✅ 100k+ rows | ✅ 100k+ rows | ✅ Unlimited |
| **Complexity** | 🟡 Medium-High | 🔴 High | 🔴 Very High |
| **SQLite Support** | ✅ TEXT (functional) | ✅ TEXT (functional) | ✅ Standard |
| **Breaking Changes** | 🟡 Moderate | 🔴 Significant | 🔴 Major |
| **Development Time** | 4-6 hours | 6-8 hours | 1-2 weeks |
| **Maintenance** | 🟡 Moderate | 🔴 High | 🔴 Very High |
| **Recommendation** | ✅ **BEST** | ⚠️ Second choice | ❌ Over-engineered |

---

## 🚀 Implementation Plan: JSONB Approach

### Step 1: Schema Creation (2 hours)

**SQLite Adapter** (`sqlite.ts`):
```typescript
// Add _json TEXT column to schema creation
columns.push('"_json" TEXT DEFAULT \'{}\'')
```

**PostgreSQL** (migration or adapter):
```sql
-- Add JSONB column
ALTER TABLE users ADD COLUMN _json JSONB DEFAULT '{}'::jsonb;

-- Create indexes
CREATE INDEX idx_users_json_roles ON users USING GIN ((_json->'roles'));
CREATE INDEX idx_users_json_tenants ON users USING GIN ((_json->'tenants'));
```

### Step 2: INSERT Logic (1 hour)

```typescript
// Collect JSON fields
const jsonData: Record<string, any> = {}
jsonFieldNames.forEach(name => {
  if (data[name] !== undefined) {
    jsonData[name] = data[name]
  }
})

// Include _json in INSERT
const hasJsonFields = Object.keys(jsonData).length > 0
if (hasJsonFields) {
  columns.push('_json')
  values.push(JSON.stringify(jsonData))
}
```

### Step 3: SELECT Logic (1 hour)

```typescript
// Deserialize _json
const deserialized: RevealDocument = { ...row }
if (row._json) {
  const jsonFields = typeof row._json === 'string'
    ? JSON.parse(row._json)  // SQLite: TEXT
    : row._json              // PostgreSQL: JSONB (already object)
  Object.assign(deserialized, jsonFields)
}
delete deserialized._json
```

### Step 4: Query Builder Enhancement (2 hours)

```typescript
// Add JSONB operator support for PostgreSQL
if (operator === 'contains' && fieldType === 'jsonb') {
  if (parameterStyle === 'postgres') {
    // Use JSONB @> operator
    whereClause = `_json->'${fieldName}' @> $${paramIndex}::jsonb`
  } else {
    // SQLite: Use json_extract
    whereClause = `json_extract(_json, '$.${fieldName}') LIKE $${paramIndex}`
  }
}
```

### Step 5: Testing (2 hours)

- Test with PostgreSQL (JSONB)
- Test with SQLite (TEXT)
- Test queries with JSONB operators
- Test indexes
- Test concurrent updates

---

## ✅ Final Recommendation

**For large-scale application: Use JSONB (PostgreSQL) + TEXT (SQLite)**

**Rationale**:
1. ✅ **Query performance** - Indexed queries, sub-millisecond lookups
2. ✅ **WHERE clause support** - Can query JSON fields efficiently
3. ✅ **Scalability** - Handles 100k+ rows efficiently
4. ✅ **Multi-database** - Works with both SQLite and PostgreSQL
5. ✅ **Future-proof** - Can add more indexes as needed
6. ✅ **Reasonable complexity** - 4-6 hours implementation

**This is the best balance of performance, functionality, and complexity for a large-scale application.**
