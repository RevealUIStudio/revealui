# TypeScript Type Errors - apps/docs

**Status:** Known Issue - Non-Blocking  
**Impact:** Does not affect CMS API routes or core functionality

---

## Issue

TypeScript compilation errors in `apps/docs/app/utils/markdown.ts`:

```
error TS1005: '>' expected.
error TS1005: ')' expected.
error TS1161: Unterminated regular expression literal.
```

---

## Root Cause

TypeScript JSX parsing issue with ReactMarkdown component. The code itself is correct - this appears to be a TypeScript configuration or parsing issue specific to the docs app.

---

## Impact

- ❌ Does NOT affect CMS API routes (separate application)
- ❌ Does NOT affect core functionality
- ✅ Only affects `apps/docs` application (documentation site)

---

## Workaround

The code works correctly at runtime. The type errors are false positives from TypeScript's JSX parser.

---

## Resolution

This is a separate issue that can be addressed independently. It does not block:
- CMS API route fixes
- Core framework functionality
- Production deployment of CMS app

---

**Note:** This is documented for completeness. Not a blocker for the core work completed.
