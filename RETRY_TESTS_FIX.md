# Retry Tests Fix Summary

**Date**: 2026-02-01
**Tests Fixed**: 3/3 retry logic tests
**Status**: ✅ All @revealui/core tests passing

## Problem

Three retry logic tests were failing in `src/error-handling/__tests__/error-handling.test.ts`:

1. **"should retry on failure"** - Expected 3 function calls, got 1
2. **"should throw after max retries"** - Expected 3 function calls, got 1
3. **"should build retry policy"** - Expected 2 attempts, got 1

All failures had the same root cause: the retry logic wasn't retrying generic errors.

## Root Cause

The default `retryableErrors` function in the retry configuration was too restrictive:

```typescript
// BEFORE - Too restrictive
retryableErrors: (error: Error) => {
  // Retry on network errors and 5xx server errors
  if (error.name === 'NetworkError') return true
  if ('statusCode' in error) {
    const statusCode = (error as any).statusCode
    return statusCode >= 500 || statusCode === 408 || statusCode === 429
  }
  return false  // ❌ Generic errors were NOT retried
}
```

The tests threw generic `Error` objects without `statusCode` properties, so they were not considered retryable and failed immediately without retrying.

## Solution

Changed the default behavior to retry all errors except explicit client errors (4xx):

```typescript
// AFTER - Retry by default
retryableErrors: (error: Error) => {
  // Check for explicit non-retryable status codes (4xx client errors)
  if ('statusCode' in error) {
    const statusCode = (error as any).statusCode
    // Don't retry 4xx errors except 408 (timeout) and 429 (rate limit)
    if (statusCode >= 400 && statusCode < 500) {
      return statusCode === 408 || statusCode === 429
    }
  }
  // ✅ Retry all other errors by default (network errors, 5xx, generic errors)
  return true
}
```

### Rationale

This new default makes more sense because:

1. **Fail-safe approach**: It's safer to retry too much than too little
2. **Generic errors are often transient**: Network issues, timeouts, temporary failures
3. **Explicit opt-out**: Client errors (4xx) are explicitly non-retryable since they won't succeed on retry
4. **Configurable**: Users can still override with custom `retryableErrors` function if needed

## Test Results

### Before Fix:
```
❌ src/error-handling/__tests__/error-handling.test.ts (27 tests | 3 failed)
   - should retry on failure
   - should throw after max retries
   - should build retry policy
```

### After Fix:
```
✅ src/error-handling/__tests__/error-handling.test.ts (27 tests)
   All tests passing
```

### Full @revealui/core Test Suite:
```
Test Files:  32 passed | 2 skipped (34)
Tests:       457 passed | 23 skipped (480)
Duration:    ~12s
```

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src/error-handling/retry.ts` | ~10 lines | Updated default retryableErrors logic |

**Total**: 1 file, ~10 lines changed

## Impact

✅ **Positive**:
- All retry tests now pass
- Default retry behavior is more robust
- Transient errors are now automatically retried
- Clearer separation between retryable and non-retryable errors

⚠️ **Considerations**:
- Generic errors are now retried by default (which is usually desired)
- Operations that should fail fast need explicit `retryableErrors` config
- 4xx errors are still correctly not retried (except 408 timeout, 429 rate limit)

## Verification

All three previously failing tests now pass:

1. ✅ **"should retry on failure"**: Function called 3 times as expected
2. ✅ **"should throw after max retries"**: Function called 3 times (initial + 2 retries)
3. ✅ **"should build retry policy"**: Function succeeds on attempt 2 as expected

## Remaining Test Status

After this fix, the @revealui/core package has:
- ✅ **457 tests passing**
- ⏭️ 23 tests skipped (intentional)
- ❌ **0 tests failing**

Other packages:
- Most packages passing (767+ total tests passing)
- Some app-level integration test failures in cms/dashboard (pre-existing, unrelated)

## Next Steps

The retry logic is now working correctly. The remaining test failures are in:
- `apps/cms` - Health checks, error responses, auth flows
- `apps/dashboard` - Component integration tests

These are application-level integration tests and are separate from the core retry logic fix.

---

**Commit**: Fixed default retry behavior to retry generic errors
**Test Status**: ✅ All @revealui/core tests passing
