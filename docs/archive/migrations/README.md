# Archived Migration Documentation

**Date Archived**: January 8, 2025  
**Reason**: Project is at v0.1.0 (initial release) with no users. These migration guides were for internal refactoring, not user-facing migrations.

---

## Archived Files

### Migration Guides (4 files)

1. **`type-system.md`** - Type system migration guide
   - **Status**: Archived - Claims v1.x→v2.0 migration, but project is v0.1.0
   - **Content**: Documents internal type system refactoring

2. **`config-system.md`** - Config system migration guide
   - **Status**: Archived - References non-existent systems (`reveal.config.ts`, `revealui/config`)
   - **Content**: Documents internal config system refactoring

3. **`plugin-system.md`** - Plugin system migration guide
   - **Status**: Archived - References non-existent systems (`revealui/plugins/*`)
   - **Content**: Documents internal plugin system refactoring

4. **`crdt-fixes-migration.md`** - CRDT fixes database migration
   - **Status**: Archived - Only needed if you have an existing database
   - **Content**: Database schema migration for CRDT fixes

### Planning Documents (2 files)

5. **`DETAILED-PLAN.md`** - Development plan
6. **`GRADE-A-CRDT-PLAN.md`** - CRDT implementation plan

### Index (1 file)

7. **`README-MIGRATION.md`** - Original migration directory index

---

## Why These Were Archived

### Project Context
- **Version**: 0.1.0 (initial release)
- **Users**: None
- **Status**: Fresh start

### Issues with Migration Docs
- ❌ Claim migrations from v1.x→v2.0, but no v1.x exists
- ❌ Reference systems that don't exist in codebase
- ❌ Not useful for new projects (no old code to migrate)
- ❌ Misleading (claim to be user migration guides but are internal refactoring notes)

### What They Actually Are
These document **internal refactoring** that happened during development, not user-facing migrations.

---

## When to Use These

These docs might be useful if:
1. You need to understand **internal refactoring history**
2. You're **reviewing codebase evolution**
3. You have an **existing database** that needs the CRDT migration (for `crdt-fixes-migration.md`)

**For new projects**: These are not needed - you're starting fresh.

---

## Current System Documentation

For current system documentation, see:
- `docs/README.md` - Main documentation index
- `BREAKING-CHANGES-CRDT.md` - Current breaking changes
- `MODERNIZATION-VERIFICATION.md` - ESM migration verification

---

**Last Updated**: January 8, 2025
