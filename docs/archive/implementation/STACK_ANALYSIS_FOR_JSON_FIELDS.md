# Stack Analysis for JSON Fields Implementation

**Date**: January 2025  
**Purpose**: Analyze the codebase stack to ensure JSON fields solution is coherent with existing architecture

**Related Analysis**: See `ELECTRICSQL_ANALYSIS_FOR_JSON_FIELDS.md` for ElectricSQL impact analysis

---

## 📦 TECHNOLOGY STACK OVERVIEW

### Database Layer
- **SQLite**: `better-sqlite3@12.5.0` (for development/testing)
- **PostgreSQL**: 
  - `pg@8.16.3` (Neon)
  - `postgres@3.4.7` (Supabase transaction pooling)
  - `@neondatabase/serverless@1.0.2` (serverless/edge)
- **Drizzle ORM**: `drizzle-orm@0.45.1` (used in `@revealui/db` package, but NOT in core `@revealui/core`)
- **No ORM in Core**: Core `@revealui/core` uses **raw SQL queries**, not Drizzle ORM

### Key Finding: **Two Database Layers**
1. **Core Layer** (`@revealui/core`): Raw SQL with custom adapters (SQLite/PostgreSQL)
2. **DB Package** (`@revealui/db`): Drizzle ORM wrapper (separate package, used by CMS app)

---

## 🏗️ ARCHITECTURE ANALYSIS

### Database Adapters Pattern

#### SQLite Adapter (`sqlite.ts`)
- **Direct SQL**: Uses `better-sqlite3` with raw SQL queries
- **Schema Creation**: Custom `createTable()` function that builds SQL DDL
- **Field Type Mapping**: Maps field types to SQL column types
- **JSON Field Handling**: 
  - `case 'json': columnDef += ' TEXT'` - JSON fields ARE created as TEXT columns
  - BUT: Complex types (`array`, `group`, `blocks`, `richText`) are **excluded** from schema creation

#### PostgreSQL Adapter (`universal-postgres.ts`)
- **Direct SQL**: Uses `pg` or `postgres` libraries with raw SQL queries
- **No Schema Creation**: Adapter only provides query function, schema managed elsewhere
- **Parameter Style**: PostgreSQL uses `$1, $2` parameter placeholders
- **Multi-Provider**: Supports Neon, Supabase, Vercel Postgres

### Current JSON Field Exclusion Logic

**Location**: `CollectionOperations.ts` lines 361-374, 448-461

```typescript
const jsonFieldTypes = ['array', 'group', 'blocks', 'richText']
const jsonFieldNames = new Set(
  (this.config.fields || [])
    .filter((field) => {
      // Fields that are stored as JSON:
      // 1. Complex types (array, group, blocks, richText)
      // 2. Select fields with hasMany (stored as JSON array)
      return (
        jsonFieldTypes.includes(field.type || '') ||
        (field.type === 'select' && (field as any).hasMany)
      )
    })
    .map((field) => field.name)
)
```

**Result**: These fields are:
1. **Excluded from INSERT/UPDATE** operations (filtered out before SQL generation)
2. **Never stored** in the database
3. **Never retrieved** (nothing to retrieve)

---

## 🔍 EXISTING PATTERNS

### Pattern 1: Explicit JSON Field Type
**Location**: `sqlite.ts` line 68-70
```typescript
case 'json':
  columnDef += ' TEXT' // Store as JSON string
  break
```

**Status**: ✅ **EXISTS** - Fields explicitly typed as `'json'` ARE created as TEXT columns
**Usage**: Not clear if this is used anywhere in the codebase

### Pattern 2: Relationship Fields
**Location**: `sqlite.ts` lines 71-78
```typescript
case 'relationship':
  // For direct FK relationships (single relationTo, no hasMany), store as FK
  if (field.relationTo && !Array.isArray(field.relationTo) && !field.hasMany) {
    columnDef += ' TEXT' // Store as foreign key (text for UUIDs)
  } else {
    columnDef += ' TEXT' // Store as JSON string for complex relations
  }
  break
```

**Analysis**: 
- Single relationships → TEXT column (FK)
- Complex relationships (`hasMany` or `relationTo` array) → TEXT column (JSON string)
- **BUT**: Complex relationships are ALSO filtered out in `CollectionOperations.ts`!
- **Contradiction**: Schema creates column, but INSERT excludes it

### Pattern 3: Serialization for SQLite Compatibility
**Location**: `CollectionOperations.ts` lines 379-386
```typescript
const values = columns.map((key) => {
  const value = data[key]
  // Serialize non-primitive values to JSON strings for SQLite compatibility
  if (value !== null && value !== undefined && (typeof value === 'object' || Array.isArray(value))) {
    return JSON.stringify(value)
  }
  return value
})
```

**Purpose**: Serializes objects/arrays to JSON strings when inserting into SQLite
**Scope**: Only applies to fields that pass the `jsonFieldNames` filter (so only non-JSON fields)
**Issue**: JSON fields are excluded before this logic runs

### Pattern 4: Deserialization on Read
**Location**: `CollectionOperations.ts` lines 145-156
```typescript
const deserialized: RevealDocument = { ...row }
for (const [key, value] of Object.entries(deserialized)) {
  if (value !== null && value !== undefined && typeof value === 'string' && 
      (value.startsWith('{') || value.startsWith('['))) {
    try {
      deserialized[key] = JSON.parse(value)
    } catch {
      // Not valid JSON, keep as string
    }
  }
}
```

**Purpose**: Deserializes JSON strings back to objects/arrays on read
**Scope**: Applies to ALL columns (checks if string starts with `{` or `[`)
**Status**: ✅ **EXISTS** - Infrastructure is there, but JSON fields never get stored

---

## 🎯 KEY INSIGHTS

### 1. **Dual Database Strategy**
- **Development/Testing**: SQLite (better-sqlite3)
- **Production**: PostgreSQL (Neon/Supabase/Vercel)
- **Solution must work for BOTH**

### 2. **No ORM in Core**
- Core uses **raw SQL** with custom adapters
- Drizzle ORM is in separate `@revealui/db` package (not used by core)
- Solution must use **raw SQL patterns**

### 3. **Schema Creation vs. Data Operations Mismatch**
- Schema creation (`sqlite.ts`) creates columns for some field types
- Data operations (`CollectionOperations.ts`) exclude JSON fields
- **Current state**: Columns might exist but are never populated

### 4. **Existing Serialization Infrastructure**
- ✅ Serialization logic exists (for non-JSON fields)
- ✅ Deserialization logic exists (for all columns)
- ✅ SQLite TEXT column support exists
- ❌ JSON fields are excluded from operations

### 5. **PostgreSQL JSON Support**
- PostgreSQL has native JSON/JSONB column types
- SQLite uses TEXT with JSON functions
- **Solution must handle both**

---

## 🔄 EXISTING DATA FLOW

### Current Flow (Non-JSON Fields)
1. **Schema Creation**: Column created in table
2. **INSERT**: Field included in INSERT query, serialized if object/array
3. **Storage**: Stored as TEXT (SQLite) or appropriate type (PostgreSQL)
4. **SELECT**: Retrieved as string
5. **Deserialization**: Parsed back to object/array if JSON-like

### Current Flow (JSON Fields - BROKEN)
1. **Schema Creation**: Column NOT created (for complex types)
2. **INSERT**: Field EXCLUDED from INSERT query
3. **Storage**: Never stored
4. **SELECT**: Nothing to retrieve
5. **Deserialization**: N/A

---

## 💡 SOLUTION COHERENCE ANALYSIS

### Option 1: Single `_json` Column ✅ **COHERENT**

**Alignment with Stack**:
- ✅ Works with raw SQL (no ORM dependency)
- ✅ Works with SQLite TEXT column (existing pattern)
- ✅ Works with PostgreSQL TEXT/JSONB (native support)
- ✅ Uses existing serialization/deserialization patterns
- ✅ Minimal schema changes (one column)
- ✅ Fits current adapter pattern

**Implementation Coherence**:
- Extends existing serialization logic
- Uses existing deserialization logic
- Follows TEXT column pattern (like `'json'` type)
- No new dependencies
- Works with both adapters

**Complexity**: Medium (2-3 hours)

---

### Option 2: Multiple JSON Columns ❌ **LESS COHERENT**

**Alignment with Stack**:
- ✅ Works with raw SQL
- ✅ Works with both databases
- ⚠️ Requires schema changes per JSON field
- ⚠️ More complex than single column
- ⚠️ Doesn't leverage existing `_json` pattern

**Implementation Coherence**:
- Requires dynamic column creation per field
- More complex than single column
- Similar to existing `'json'` field type, but different approach

**Complexity**: High (4-5 hours)

---

### Option 3: Normalized Tables ❌ **NOT COHERENT**

**Alignment with Stack**:
- ✅ Works with raw SQL
- ❌ **Major architectural shift** - No junction tables currently used
- ❌ **Over-engineering** for arrays/objects
- ❌ **High complexity** - Doesn't match existing patterns
- ❌ Would require relationship management system

**Implementation Coherence**:
- Doesn't match existing simple column pattern
- Would require new relationship management
- Much more complex than current architecture

**Complexity**: Very High (1-2 weeks)

---

### Option 4: Keep In-Memory Only ❌ **NOT COHERENT**

**Alignment with Stack**:
- ❌ Tests expect persistence
- ❌ Doesn't match existing patterns (other fields persist)
- ❌ Data loss

**Implementation Coherence**:
- Contradicts existing persistence patterns
- Inconsistent with other field types

**Complexity**: None (but requires updating 13 tests)

---

## 🎯 RECOMMENDATION: Option 1 (Single `_json` Column)

### Why It's Coherent:

1. **Matches Existing Patterns**
   - Uses TEXT column (like explicit `'json'` type)
   - Uses existing serialization/deserialization logic
   - Follows simple column pattern (no complex relationships)

2. **Works with Current Architecture**
   - Raw SQL (no ORM dependency)
   - Both SQLite and PostgreSQL
   - Existing adapter pattern
   - Minimal schema changes

3. **Leverages Existing Infrastructure**
   - Serialization logic exists
   - Deserialization logic exists
   - TEXT column support exists
   - Just needs to include JSON fields in operations

4. **Minimal Changes Required**
   - Add `_json TEXT` column to schema
   - Include JSON fields in INSERT/UPDATE
   - Deserialization already handles it
   - No new dependencies

5. **Future-Proof**
   - Can migrate to JSONB (PostgreSQL) later
   - Can add JSON indexes if needed
   - Can normalize later if requirements change

---

## 📋 IMPLEMENTATION CHECKLIST

### Schema Changes
- [ ] Add `_json TEXT` column to SQLite schema creation
- [ ] Document PostgreSQL JSON/JSONB support (future enhancement)
- [ ] Handle schema migration for existing tables

### INSERT Operations
- [ ] Collect JSON fields into `_json` object
- [ ] Serialize `_json` object to JSON string
- [ ] Include `_json` column in INSERT query
- [ ] Handle empty/null JSON fields

### SELECT Operations
- [ ] Existing deserialization logic should handle `_json` column
- [ ] Merge `_json` fields into result document
- [ ] Remove `_json` from result (internal column)

### UPDATE Operations
- [ ] Merge existing `_json` with updates
- [ ] Include `_json` in UPDATE query
- [ ] Handle partial JSON field updates

### Testing
- [ ] Test with SQLite adapter
- [ ] Test with PostgreSQL adapter
- [ ] Test serialization/deserialization
- [ ] Test empty/null JSON fields
- [ ] Test schema migration

---

## 🔍 ADDITIONAL CONSIDERATIONS

### PostgreSQL JSON vs JSONB
- **TEXT column**: Works everywhere, serialization in app
- **JSONB column**: Native JSON type, better indexing (future enhancement)
- **Recommendation**: Start with TEXT, can migrate to JSONB later

### Schema Migration
- Existing tables need `_json` column added
- Can use `ALTER TABLE ADD COLUMN` (SQLite and PostgreSQL support)
- Need migration strategy for production

### Indexing
- Can't efficiently index JSON fields in TEXT column
- PostgreSQL JSONB supports indexes (future enhancement)
- For now, accept limitation (matches current architecture)

### Query Performance
- Can't query JSON fields in WHERE clauses efficiently
- SQLite JSON functions available but slower
- PostgreSQL JSONB supports queries (future enhancement)
- For now, accept limitation (matches current architecture)

---

## ✅ FINAL VERDICT

**Option 1 (Single `_json` Column) is the most coherent solution** because:

1. ✅ Matches existing patterns (TEXT columns, serialization)
2. ✅ Works with current architecture (raw SQL, both databases)
3. ✅ Leverages existing infrastructure (serialization/deserialization)
4. ✅ Minimal changes required
5. ✅ Future-proof (can enhance later)

**The solution aligns perfectly with the codebase's existing patterns and architecture.**
