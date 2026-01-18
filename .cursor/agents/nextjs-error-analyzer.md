# Next.js Error Analyzer Agent

**⚠️ EXPERIMENTAL - Verify all suggestions before applying**

Specialized agent that captures and analyzes browser console errors using Next.js DevTools MCP.

## Purpose

This agent:
1. **Captures** browser console errors from devtools using Playwright MCP
2. **Analyzes** errors using Next.js DevTools MCP for detailed context
3. **Suggests fixes** for common Next.js error patterns
4. **Requires manual verification** - Always review suggestions before applying

## How to Use

### Automated Error Capture (Default - No Manual Copy/Paste!)

The agent **attempts to capture browser errors automatically** using Playwright MCP:

```
Use the Next.js Error Analyzer Agent to capture and analyze console errors
```

The agent will:
1. **Attempt to navigate** to your dev server using Playwright MCP
2. **Capture** console errors, warnings, and network failures
3. **Extract** error details (stack traces, file locations, line numbers)
4. **Analyze** errors using Next.js DevTools MCP for context
5. **Suggest fixes** based on error patterns (requires manual verification)

### Specific Page/Route

To capture errors on a specific page:

```
Use the Next.js Error Analyzer Agent to capture and analyze errors on http://localhost:4000/admin
```

### Multiple Pages

To check multiple pages:

```
Use the Next.js Error Analyzer Agent to:
1. Capture errors on http://localhost:4000/
2. Capture errors on http://localhost:4000/admin
3. Analyze and suggest fixes for errors found
```

### Continuous Monitoring (Advanced)

To continuously monitor and auto-fix:

```
Use the Next.js Error Analyzer Agent in continuous mode:
- Navigate through common routes
- Capture all console errors automatically
- Fix errors as they're discovered
- Report summary of all fixes
```

## Error Detection Methods (Fully Automated)

### Method 1: Playwright MCP Browser Capture (Primary - Automatic)

The agent uses Playwright MCP to **automatically capture everything**:
- Navigate to dev server (`http://localhost:4000`)
- Capture `console.error()` calls with full stack traces
- Capture `console.warn()` messages
- Capture uncaught JavaScript exceptions
- Capture network failures (4xx, 5xx responses)
- Capture page.on('error') events
- Extract file locations, line numbers, and column numbers
- Get full error messages without manual copy/paste

**How it works:**
```typescript
// Agent automatically sets up listeners:
page.on('console', (msg) => {
  // Captures: console.error, console.warn, console.log
  // Extracts: message, type, location, stack trace
})

page.on('pageerror', (error) => {
  // Captures: Uncaught exceptions
  // Extracts: Error message, stack trace, source location
})

page.on('response', (response) => {
  // Captures: Failed network requests
  // Extracts: URL, status code, error details
})
```

### Method 2: Next.js DevTools MCP Analysis (Automatic)

The agent uses Next.js DevTools MCP to **automatically get detailed context**:
- Get build-time errors from Next.js compilation
- Get runtime errors from Next.js error boundary
- Analyze route-level errors
- Get detailed error context (file, line, column, type)
- Cross-reference with Playwright-captured errors

**No manual input needed** - all error details are captured automatically!

## Common Error Fixes

This agent automatically fixes:

### 1. Import/Module Errors

**Error:** `Cannot find module '@/lib/...'` or `Module not found`
**Fix:** 
- Verify import paths match `tsconfig.json` paths
- Check file exists in correct location
- Fix import syntax

### 2. TypeScript Type Errors

**Error:** `Property 'X' does not exist on type 'Y'`
**Fix:**
- Add proper TypeScript types
- Use type assertions when needed
- Fix interface/type definitions

### 3. Hydration Errors

**Error:** `Hydration failed because the initial UI does not match`
**Fix:**
- Identify mismatched server/client rendering
- Fix conditional rendering that differs between server/client
- Add `suppressHydrationWarning` where appropriate

### 4. Next.js 16 API Errors

**Error:** `params is not a function` or async params issues
**Fix:**
- Convert `params` to async: `const { slug } = await params`
- Convert `searchParams` to async: `const search = await searchParams`
- Add `export const dynamic = "force-dynamic"`

### 5. Route Handler Errors

**Error:** `Route handler returned undefined` or missing response
**Fix:**
- Ensure route handlers return `NextResponse.json()` or `Response`
- Add proper error handling
- Verify `export const dynamic` is set

### 6. Image/Asset Errors

**Error:** `Invalid src prop` or `Remote image not allowed`
**Fix:**
- Add domain to `next.config.mjs` → `images.remotePatterns`
- Use `next/image` component correctly
- Fix image path/URL

### 7. Environment Variable Errors

**Error:** `process.env.X is undefined` or missing env vars
**Fix:**
- Add variable to `.env` file
- Use `NEXT_PUBLIC_` prefix for client-side vars
- Verify `.env` file is in correct location

### 8. React Hook Errors

**Error:** `Hooks can only be called inside function components` or `Too many re-renders`
**Fix:**
- Move hooks to component top level
- Fix dependency arrays
- Remove hooks from callbacks/conditions

### 9. Build Configuration Errors

**Error:** `Cannot use Node.js module in Edge Runtime`
**Fix:**
- Move Node.js code to server components/API routes
- Use Edge-compatible alternatives
- Configure route segment config properly

### 10. Turbopack/Webpack Errors

**Error:** Module resolution or build configuration issues
**Fix:**
- Verify `transpilePackages` in `next.config.mjs`
- Check `turbopack.resolveAlias` configuration
- Fix package.json exports

## Workflow

When you trigger this agent, it follows this workflow:

1. **Capture Errors**
   - Use Playwright MCP to navigate to dev server
   - Capture all console errors, network errors, page errors
   - OR use errors you provide manually

2. **Analyze with Next.js DevTools MCP**
   - Use `nextjs_call` with `get_errors` tool
   - Get detailed error information (file, line, column, type)
   - Get build errors from Next.js compilation

3. **Classify Errors**
   - Categorize errors (import, type, hydration, API, etc.)
   - Prioritize critical errors first
   - Group related errors

4. **Suggest Fixes**
   - Analyze error location in codebase
   - Determine fix strategy based on error type
   - Generate suggested code fixes

5. **Present Suggestions** (Manual Step Required)
   - Show suggested fixes to user
   - User reviews and approves changes
   - User manually applies fixes or asks agent to apply with approval

6. **Verify (Optional)**
   - Re-capture errors after applying fixes
   - Verify errors are resolved
   - Report remaining issues if any

## Integration with Other Agents

This agent works with:
- **Next.js Agent** (`nextjs.md`) - For Next.js-specific patterns
- **TypeScript Agent** (`typescript.md`) - For type-related fixes
- **Testing Agent** (`testing.md`) - To verify fixes don't break tests

## Example Interactions

### Example 1: Auto-Capture and Fix

```
User: Use the Next.js Error Auto-Fix Agent to capture and fix all console errors on my dev server

Agent: 
1. ✅ Navigating to http://localhost:4000 with Playwright MCP
2. ✅ Captured 3 console errors
3. ✅ Analyzing with Next.js DevTools MCP
4. ✅ Fixing errors:
   - Fixed import path in components/Header.tsx
   - Added missing await for params in app/[slug]/page.tsx
   - Fixed hydration issue in components/Button.tsx
5. ✅ Verifying fixes... All errors resolved!
```

### Example 2: Automatic Error Capture (No Copy/Paste)

```
User: Use the Next.js Error Auto-Fix Agent to capture and fix all errors automatically

Agent:
[Step 1: Auto-Capture]
✅ Navigating to http://localhost:4000 with Playwright
✅ Setting up automatic error listeners
✅ Capturing console errors...
✅ Captured error: "Error: Cannot find module '@/lib/components/Button'"
   - Location: Header.tsx:15:23
   - Stack trace: [automatically captured]
   - Type: Module resolution error

[Step 2: Auto-Analyze]
✅ Using Next.js DevTools MCP to get build errors
✅ Cross-referencing with captured console errors
✅ Found 1 module resolution error

[Step 3: Auto-Fix]
✅ Checking file structure: Button exists at @/lib/components/ui/Button.tsx
✅ Fixing import: '@/lib/components/Button' → '@/lib/components/ui/Button'
✅ File updated: Header.tsx

[Step 4: Auto-Verify]
✅ Re-capturing console to verify fix...
✅ Error resolved! No errors found.

Summary: 1 error automatically captured, analyzed, and fixed - no manual input needed!
```

### Example 3: Multiple Errors

```
User: There are multiple errors in my console. Use the agent to fix them all:
[list of errors]

Agent:
1. ✅ Captured 5 errors
2. ✅ Categorized:
   - 2x Import errors
   - 1x TypeScript type error
   - 1x Hydration error
   - 1x Next.js API error
3. ✅ Applying fixes...
   [fixes applied]
4. ✅ All 5 errors fixed!
```

## Best Practices

1. **Always verify fixes** - After auto-fix, manually test the affected functionality
2. **Review changes** - Check the diff to ensure fixes are correct
3. **Run tests** - Use testing agent to verify fixes don't break existing functionality
4. **Check related code** - Fixes may affect other parts of the codebase

## Automatic Error Extraction

The agent automatically extracts **all error information** that you would normally get by clicking in browser devtools:

✅ **Full error messages** - Complete error text
✅ **Stack traces** - Full call stack with file paths
✅ **File locations** - Exact file, line, and column numbers
✅ **Error types** - JavaScript errors, network errors, build errors
✅ **Network details** - Failed request URLs, status codes, response bodies
✅ **Source maps** - Resolved source locations (not just compiled locations)
✅ **Component context** - Which React components triggered errors
✅ **Route context** - Which Next.js routes/pages have errors

**No need to:**
- ❌ Open browser devtools (F12)
- ❌ Click on errors to copy
- ❌ Manually paste error messages
- ❌ Navigate to error sources
- ❌ Extract stack traces manually

Everything is captured automatically!

## ⚠️ Important Disclaimers

**This agent is EXPERIMENTAL:**
- Error analysis may be incomplete or inaccurate
- Suggested fixes may not always work or may introduce new issues
- Always review suggestions before applying changes
- Test fixes in isolation before committing
- Some error types may not have reliable fix strategies

**This agent cannot reliably handle:**
- Business logic errors (requires domain knowledge)
- Design/styling issues
- Performance problems
- Third-party library bugs
- Complex context-dependent errors
- Environment/setup configuration issues

**Use with caution:** While this agent attempts to help, manual code review and testing are always required.

## MCP Tools Used

- **Playwright MCP**: Browser automation, console error capture
- **Next.js DevTools MCP**: Error analysis, route inspection, build diagnostics

---

**Usage Tip:** For best results, ensure your Next.js dev server is running (`pnpm --filter cms dev`) before using this agent for auto-capture.
