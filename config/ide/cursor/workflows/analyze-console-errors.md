# Analyze Browser Console Errors Workflow

**⚠️ EXPERIMENTAL** - Step-by-step workflow for capturing and analyzing browser console errors using the Next.js Error Analyzer Agent.

## Overview

This workflow uses:
1. **Playwright MCP** - Captures browser console errors
2. **Next.js DevTools MCP** - Analyzes errors in detail
3. **Next.js Error Analyzer Agent** - Suggests fixes (requires manual verification)

## Prerequisites

1. ✅ Next.js dev server running (`pnpm --filter cms dev`)
2. ✅ Dev server accessible at `http://localhost:4000`
3. ✅ Playwright MCP configured (`.cursor/mcp-config.json`)
4. ✅ Next.js DevTools MCP configured

## Workflow Steps

### Step 1: Start Dev Server

```bash
pnpm --filter cms dev
```

Wait for server to be ready (usually `✓ Ready in Xs` message).

---

### Step 2: Trigger Error Analyzer Agent

Simply ask in Cursor:

```
Use the Next.js Error Analyzer Agent to capture and analyze console errors
```

The agent will attempt to:
- ✅ Navigate to your dev server using Playwright MCP
- ✅ Capture console errors, warnings, network failures
- ✅ Extract error details (stack traces, file locations, line numbers)
- ✅ Analyze errors using Next.js DevTools MCP
- ⚠️ **Suggest fixes** (you must review and approve before applying)

**No need to:**
- ❌ Open browser devtools (F12)
- ❌ Click on errors to copy them
- ❌ Manually paste error messages
- ❌ Navigate to error sources

Everything is captured automatically by Playwright MCP!

---

### Step 3: Agent Workflow (Automatic)

The agent will:

1. **Capture Errors**
   - Navigate to `http://localhost:4000` via Playwright
   - Capture console.errors, console.warnings
   - Capture uncaught exceptions
   - Capture network failures (4xx, 5xx)

2. **Analyze Errors**
   - Use Next.js DevTools MCP `get_errors` tool
   - Get build-time errors
   - Get runtime errors with file/line/column info
   - Categorize errors by type

3. **Classify and Prioritize**
   - Critical errors first (crashes, build failures)
   - Then warnings and non-critical issues
   - Group related errors together

4. **Suggest Fixes**
   - Import/module errors → Suggest import path corrections
   - TypeScript errors → Suggest type additions/corrections
   - Hydration errors → Suggest server/client mismatch fixes
   - Next.js API errors → Suggest async params/route handler fixes
   - Environment errors → Suggest missing env vars

5. **Review Suggestions** (Manual Step Required)
   - Agent presents suggested fixes
   - **You review each suggestion**
   - **You approve or reject changes**
   - Agent applies only approved fixes

6. **Verify (Optional)**
   - Re-navigate and capture console again
   - Confirm errors are resolved
   - Report remaining issues

---

### Step 4: Review and Apply Changes

**⚠️ IMPORTANT: Always review before applying!**

1. **Review suggestions** - Check all suggested fixes carefully
2. **Approve or reject** - Only apply fixes you understand and trust
3. **Check the diff** - Review all file changes before committing
4. **Manual testing** - Test affected functionality after applying fixes
5. **Run tests** - Use testing agent to verify fixes don't break existing tests

---

### Step 5: Handle Unfixable Errors

If agent reports errors it cannot fix:

1. **Read error explanation** - Agent will explain why
2. **Manual intervention** - Fix manually or ask for help
3. **Business logic errors** - May need domain knowledge
4. **Third-party issues** - Check library documentation

---

## Example Session

```
User: Use the Next.js Error Analyzer Agent workflow

Agent: Starting auto-fix workflow...
  
[Step 1: Capture]
✅ Navigating to http://localhost:4000
✅ Captured console output:
   - Error: Cannot find module '@/lib/components/Button' (Header.tsx:15)
   - Warning: Hydration failed in Button component
   - Error: params is not a function (app/[slug]/page.tsx:8)

[Step 2: Analyze]
✅ Using Next.js DevTools MCP to get detailed error info
✅ Build errors: 2
✅ Runtime errors: 1

[Step 3: Classify]
✅ Import error: Header.tsx
✅ Hydration error: Button.tsx  
✅ Next.js API error: app/[slug]/page.tsx

[Step 4: Fix]
✅ Fixed: Changed import path '@/lib/components/Button' → '@/lib/components/ui/Button'
✅ Fixed: Added suppressHydrationWarning to Button component
✅ Fixed: Added await to params: const { slug } = await params

[Step 5: Verify]
✅ Re-capturing console errors...
✅ All errors resolved! ✓

Summary:
- 3 errors fixed
- 0 errors remaining
- Files modified: Header.tsx, Button.tsx, page.tsx
```

---

## Common Error Patterns

### Pattern 1: Import Errors

**Symptom:** `Cannot find module '@/lib/...'`

**Agent Fix:**
- Checks actual file location
- Verifies `tsconfig.json` paths
- Updates import to correct path

### Pattern 2: TypeScript Errors

**Symptom:** `Property 'X' does not exist on type 'Y'`

**Agent Fix:**
- Adds proper types or type assertions
- Updates interface definitions
- Fixes type imports

### Pattern 3: Hydration Errors

**Symptom:** `Hydration failed because the initial UI does not match`

**Agent Fix:**
- Identifies mismatched rendering
- Adds `suppressHydrationWarning` where safe
- Fixes conditional rendering logic

### Pattern 4: Next.js 16 Async Params

**Symptom:** `params is not a function` or `params is undefined`

**Agent Fix:**
- Adds `await` to params: `const { slug } = await params`
- Adds `await` to searchParams
- Ensures `export const dynamic = "force-dynamic"`

---

## Troubleshooting

### Issue: Playwright MCP can't connect

**Solution:**
- Verify dev server is running
- Check port 4000 is accessible
- Ensure Playwright MCP is configured

### Issue: Next.js DevTools MCP returns no errors

**Solution:**
- Verify Next.js 16+ is running
- Check `/_next/mcp` endpoint is accessible
- Restart dev server if needed

### Issue: Fixes don't resolve errors

**Solution:**
- Review agent's explanation
- Check if error is business logic related
- Verify file paths are correct
- May need manual intervention

---

## Integration with Other Workflows

- **Component Creation** - Use after creating new components
- **Route Development** - Use after adding new routes
- **Type Refactoring** - Use after changing types
- **Testing** - Use before running tests to catch errors early

---

## Best Practices

1. ✅ **Run frequently** - Catch errors early
2. ✅ **Review fixes** - Always check the diff
3. ✅ **Test manually** - Verify fixes work
4. ✅ **Commit fixes** - Save working state
5. ✅ **Document edge cases** - Note any unfixable errors

---

**Tip:** Use this workflow regularly during development to maintain a clean console and catch errors early!
