# JSON Fields Storage Architecture Analysis

**Date**: January 2025  
**Context**: 13 test failures related to JSON fields not being persisted  
**Current State**: JSON fields are excluded from database operations

---

## 🔍 CURRENT IMPLEMENTATION

### What Are JSON Fields?
According to the code, JSON fields include:
- **Complex types**: `array`, `group`, `blocks`, `richText`
- **Select fields with `hasMany`**: Multi-select fields (stored as JSON array)
- **Examples**: `roles` (array of strings), `tenants` (array), nested objects

### Current Behavior
```typescript
// JSON fields are filtered out BEFORE database operations
const jsonFieldNames = new Set(
  fields.filter(field => 
    jsonFieldTypes.includes(field.type) || 
    (field.type === 'select' && field.hasMany)
  ).map(field => field.name)
)

// Only non-JSON fields are inserted/updated
const columns = Object.keys(data).filter(k => !jsonFieldNames.has(k))
```

**Result**: JSON fields are **never stored in the database**. They exist only in memory during the request.

---

## 📊 APPROACH COMPARISON

### Option 1: Store JSON Fields in Single JSON Column ✅ **RECOMMENDED**

**Architecture**: Add a single `_json` TEXT column to each table, store all JSON fields as a JSON object.

#### Implementation
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  password TEXT,
  -- ... other columns ...
  _json TEXT  -- Stores: {"roles": ["admin"], "metadata": {...}}
)
```

#### Code Changes Required
1. **Schema Creation** (`sqlite.ts`):
   - Add `_json TEXT` column to all tables
   - Or make it optional (only if JSON fields exist)

2. **INSERT Operations** (`CollectionOperations.ts`):
   ```typescript
   const jsonData = {}
   jsonFieldNames.forEach(name => {
     if (data[name] !== undefined) {
       jsonData[name] = data[name]
     }
   })
   const jsonColumn = jsonFieldNames.size > 0 ? '"_json"' : ''
   const jsonValue = Object.keys(jsonData).length > 0 ? JSON.stringify(jsonData) : null
   ```

3. **SELECT Operations**:
   ```typescript
   // Deserialize _json column
   if (row._json) {
     const jsonFields = JSON.parse(row._json)
     Object.assign(result, jsonFields)
   }
   ```

4. **UPDATE Operations**:
   ```typescript
   // Merge existing JSON with updates
   const existingJson = existingDoc._json ? JSON.parse(existingDoc._json) : {}
   const updatedJson = { ...existingJson, ...jsonUpdates }
   ```

#### Pros ✅
- **Simple implementation** - Single column, straightforward serialization
- **Preserves all data** - All JSON fields stored and retrievable
- **SQLite native support** - JSON functions available (`json_extract`, `json_each`)
- **Flexible schema** - Easy to add new JSON fields without migrations
- **Atomic updates** - Single column update, no joins needed
- **Performance** - Single column read/write, minimal overhead
- **Backward compatible** - Can add without breaking existing data

#### Cons ❌
- **No SQL querying** - Can't query JSON fields directly in WHERE clauses (limited by SQLite JSON functions)
- **Limited indexing** - Can't index individual JSON properties efficiently
- **Large documents** - Single column can grow large with many/complex JSON fields
- **Schema migration** - Existing tables need `_json` column added
- **Query performance** - Filtering by JSON fields requires parsing (can use JSON functions but slower)

#### Complexity: **Medium** (2-3 hours)
- Schema changes: 30 min
- INSERT logic: 30 min
- SELECT deserialization: 30 min
- UPDATE merge logic: 30 min
- Testing: 1 hour

---

### Option 2: Store JSON Fields in Separate JSON Columns (One Per Field)

**Architecture**: Create a separate TEXT column for each JSON field.

#### Implementation
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  password TEXT,
  roles TEXT,  -- JSON: ["admin", "user"]
  tenants TEXT,  -- JSON: [...]
  metadata TEXT  -- JSON: {...}
)
```

#### Code Changes Required
1. **Schema Creation**: Include JSON fields as TEXT columns
2. **INSERT/UPDATE**: Serialize each JSON field individually
3. **SELECT**: Deserialize each JSON column

#### Pros ✅
- **Direct column access** - Each field has its own column
- **Better for querying** - Can use SQLite JSON functions per column
- **Clearer schema** - Field names visible in schema
- **Easier debugging** - Can inspect individual JSON columns

#### Cons ❌
- **Schema complexity** - Many columns for complex documents
- **Migration overhead** - Need to add columns for each JSON field
- **Rigid schema** - Adding new JSON fields requires schema changes
- **Column limit** - SQLite has a practical limit on columns (2000+)
- **More code** - Handle each field separately

#### Complexity: **High** (4-5 hours)
- Dynamic column creation: 2 hours
- Per-field serialization: 1 hour
- Migration logic: 1 hour
- Testing: 1 hour

---

### Option 3: Normalized Tables (Junction Tables)

**Architecture**: Store array fields in separate junction tables.

#### Implementation
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  -- ... other columns ...
)

CREATE TABLE user_roles (
  user_id TEXT,
  role TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
)

CREATE TABLE user_tenants (
  user_id TEXT,
  tenant_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

#### Pros ✅
- **Proper normalization** - Follows relational database principles
- **SQL querying** - Can query with JOINs, indexes, etc.
- **Data integrity** - Foreign key constraints
- **Scalability** - Efficient for large datasets
- **Flexible queries** - Complex WHERE clauses on JSON data

#### Cons ❌
- **High complexity** - Multiple tables, JOINs required
- **Performance overhead** - Multiple queries or JOINs for reads
- **Schema migration** - Complex migration logic
- **Not flexible** - Hard to handle nested objects, mixed types
- **Over-engineering** - Too complex for simple arrays/objects
- **Breaking change** - Major architectural shift

#### Complexity: **Very High** (1-2 weeks)
- Junction table design: 1 day
- Relationship management: 2-3 days
- Query building: 2-3 days
- Migration: 1-2 days
- Testing: 2-3 days

---

### Option 4: Keep Current Approach (In-Memory Only) ❌ **NOT RECOMMENDED**

**Architecture**: JSON fields exist only during request, never persisted.

#### Pros ✅
- **No changes needed** - Current implementation
- **Simple** - No database complexity
- **Fast writes** - No JSON serialization overhead

#### Cons ❌
- **Data loss** - JSON fields disappear after request
- **Tests fail** - 13 tests expect persistence
- **Incomplete functionality** - Core CMS feature missing
- **User confusion** - Data "saved" but not stored
- **Not production-ready** - Critical functionality missing

#### Complexity: **None** (but requires updating 13 tests)

---

### Option 5: Hybrid Approach (JSON Column + Selective Normalization)

**Architecture**: Use JSON column for simple/complex JSON, normalized tables for frequently-queried arrays.

#### Implementation
- Store `roles` array in junction table (frequently queried)
- Store `metadata` object in `_json` column (rarely queried)

#### Pros ✅
- **Best of both worlds** - Query performance where needed, flexibility elsewhere
- **Optimized** - Can index/query important fields

#### Cons ❌
- **High complexity** - Two different storage mechanisms
- **Inconsistency** - Different patterns for different fields
- **More code** - Handle both approaches
- **Decision overhead** - Need to decide which approach per field

#### Complexity: **Very High** (1 week+)
- Decision framework: 1 day
- Dual implementation: 3-4 days
- Testing: 2-3 days

---

## 🎯 RECOMMENDATION: Option 1 (Single JSON Column)

### Why Option 1?

1. **Balances simplicity and functionality**
   - Simple implementation (2-3 hours)
   - Meets all test requirements
   - Preserves all data

2. **SQLite JSON support**
   - SQLite 3.9+ has excellent JSON functions
   - Can query with `json_extract()` if needed
   - Good performance for most use cases

3. **Flexible and extensible**
   - Easy to add new JSON fields
   - No schema changes needed
   - Works for arrays, objects, nested structures

4. **Industry standard**
   - Used by many CMS frameworks (Strapi, Directus use JSON columns)
   - Proven approach
   - Good balance of features and complexity

5. **Future-proof**
   - Can migrate to normalized tables later if needed
   - Can add indexes on specific JSON paths if needed (SQLite 3.38+)
   - Doesn't lock you into a rigid schema

### Implementation Details

#### Schema Change
```typescript
// sqlite.ts - createTable function
columns.push('"_json" TEXT')  // Add after standard columns
```

#### INSERT Logic
```typescript
// CollectionOperations.ts - create method
const jsonData: Record<string, any> = {}
jsonFieldNames.forEach(name => {
  if (data[name] !== undefined) {
    jsonData[name] = data[name]
  }
})

const hasJsonFields = Object.keys(jsonData).length > 0
const columns = Object.keys(data).filter(k => k !== 'id' && !jsonFieldNames.has(k))
if (hasJsonFields) {
  columns.push('_json')
}

const values = columns.map(key => {
  if (key === '_json') {
    return JSON.stringify(jsonData)
  }
  return data[key]
})
```

#### SELECT Logic
```typescript
// CollectionOperations.ts - find/findByID methods
const deserialized: RevealDocument = { ...row }
if (row._json) {
  try {
    const jsonFields = JSON.parse(row._json)
    Object.assign(deserialized, jsonFields)
  } catch {
    // Invalid JSON, skip
  }
}
// Remove _json from result
delete deserialized._json
```

#### UPDATE Logic
```typescript
// CollectionOperations.ts - update method
const existingJson = existingDoc._json 
  ? JSON.parse(existingDoc._json) 
  : {}

const updatedJson = { ...existingJson }
jsonFieldNames.forEach(name => {
  if (data[name] !== undefined) {
    updatedJson[name] = data[name]
  }
})

// Include _json in UPDATE if JSON fields changed
if (JSON.stringify(existingJson) !== JSON.stringify(updatedJson)) {
  keys.push('_json')
  values.push(JSON.stringify(updatedJson))
}
```

---

## 📋 DECISION MATRIX

| Approach | Complexity | Performance | Flexibility | Query Support | Recommended |
|----------|-----------|-------------|-------------|---------------|-------------|
| **Option 1: Single JSON Column** | Medium | Good | High | Limited | ✅ **YES** |
| Option 2: Multiple JSON Columns | High | Good | Medium | Good | ⚠️ Maybe |
| Option 3: Normalized Tables | Very High | Excellent | Low | Excellent | ❌ No |
| Option 4: In-Memory Only | None | N/A | N/A | None | ❌ **NO** |
| Option 5: Hybrid | Very High | Excellent | High | Excellent | ⚠️ Future |

---

## ✅ FINAL RECOMMENDATION

**Implement Option 1 (Single JSON Column)** for the following reasons:

1. **Quick to implement** (2-3 hours)
2. **Solves all 13 test failures**
3. **Industry-standard approach**
4. **Flexible and extensible**
5. **Good performance for CMS workloads**
6. **Can evolve later** if needed

**Next Steps**:
1. Add `_json TEXT` column to schema creation
2. Implement JSON serialization in INSERT
3. Implement JSON deserialization in SELECT
4. Implement JSON merging in UPDATE
5. Update tests to verify JSON fields persist
6. Run full test suite

**Estimated Time**: 2-3 hours  
**Risk Level**: Low  
**Impact**: Fixes 13 test failures, enables JSON field persistence
