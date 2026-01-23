# TypeScript Fixes

## Fix packages/presentation/src/components/Checkbox.tsx
**Issue:** TypeScript strict mode errors with exactOptionalPropertyTypes
**Fix:** Add explicit undefined types to optional properties

**Code Changes:**
```typescript
// Before: interface Props { disabled?: boolean }
// After: interface Props { disabled?: boolean | undefined }
```

## Fix packages/presentation/src/components/avatar.tsx
**Issue:** TypeScript strict mode errors with exactOptionalPropertyTypes
**Fix:** Add explicit undefined types to optional properties

**Code Changes:**
```typescript
// Before: interface Props { disabled?: boolean }
// After: interface Props { disabled?: boolean | undefined }
```

## Fix packages/presentation/src/components/combobox.tsx
**Issue:** TypeScript strict mode errors with exactOptionalPropertyTypes
**Fix:** Add explicit undefined types to optional properties

**Code Changes:**
```typescript
// Before: interface Props { disabled?: boolean }
// After: interface Props { disabled?: boolean | undefined }
```

## Fix packages/presentation/src/components/dropdown.tsx
**Issue:** TypeScript strict mode errors with exactOptionalPropertyTypes
**Fix:** Add explicit undefined types to optional properties

**Code Changes:**
```typescript
// Before: interface Props { disabled?: boolean }
// After: interface Props { disabled?: boolean | undefined }
```

## Fix packages/presentation/src/components/listbox.tsx
**Issue:** TypeScript strict mode errors with exactOptionalPropertyTypes
**Fix:** Add explicit undefined types to optional properties

**Code Changes:**
```typescript
// Before: interface Props { disabled?: boolean }
// After: interface Props { disabled?: boolean | undefined }
```

## Fix packages/presentation/src/components/table.tsx
**Issue:** TypeScript strict mode errors with exactOptionalPropertyTypes
**Fix:** Add explicit undefined types to optional properties

**Code Changes:**
```typescript
// Before: interface Props { disabled?: boolean }
// After: interface Props { disabled?: boolean | undefined }
```

# Linting Fixes

## Fix scripts/verify-claims.ts
**Issue:** useNodejsImportProtocol lint violation
**Fix:** Change import fs from "fs" to import fs from "node:fs"

## Fix scripts/verify-claims.ts
**Issue:** useParseIntRadix lint violation
**Fix:** Add radix parameter to parseInt calls

# Test Fixes

## Fix packages/dev/src/__tests__/integration/configs.integration.test.ts
**Issue:** Cannot find package @revealui/core
**Fix:** Fix missing dependency imports in dev package

## Fix packages/dev/src/__tests__/integration/configs.integration.test.ts
**Issue:** Cannot find package dev/eslint
**Fix:** Fix incorrect import paths in test files

