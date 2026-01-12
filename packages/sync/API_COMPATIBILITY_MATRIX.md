# API Compatibility Matrix

This document tracks ElectricSQL API compatibility assumptions and verification status for the upgrade to ElectricSQL 1.1+.

## Current API Assumptions

### Shape URL Format

- **Endpoint**: `/v1/shape`
- **Base URL**: `http://localhost:5133` or configured service URL
- **Full URL**: `{baseUrl}/v1/shape`
- **Status**: ✅ Verified in tests
- **Notes**: Trailing slashes are handled automatically

### Shape Params Structure

```typescript
{
  table: string              // Table name (e.g., 'agent_memories')
  where: string              // SQL WHERE clause with $1, $2, etc.
  params: Record<string, string>  // Parameter values keyed by index
  orderBy: string            // SQL ORDER BY clause
  limit?: number            // Optional limit
}
```

**Status**: ✅ Verified in tests

### useShape Hook API

From `@electric-sql/react` package:

```typescript
useShape({
  url: string                    // Shape endpoint URL
  params?: ShapeParams          // Shape parameters
  headers?: Record<string, () => string>  // Optional headers (functions)
})
```

**Return Type**:
```typescript
{
  isLoading: boolean
  data: T[]                    // Array of rows
  error: Error | null
  isError: boolean
}
```

**Status**: ✅ Structure verified, actual hook from package

### Error Handling

- **Invalid URL**: Throws error with descriptive message
- **Missing URL**: Handled gracefully in provider (returns null config)
- **Network Errors**: Handled by useShape hook (returns error state)

**Status**: ✅ Verified in tests

## Compatibility Checklist

### Pre-Upgrade (Current State)

- [x] Shape URL format verified
- [x] Shape params structure verified
- [x] useShape hook structure verified
- [x] Error handling patterns verified
- [x] Type definitions verified

### Post-Upgrade (ElectricSQL 1.1+)

- [ ] Verify shape URL format unchanged
- [ ] Verify shape params structure unchanged
- [ ] Verify useShape hook API unchanged
- [ ] Verify error handling patterns unchanged
- [ ] Verify type definitions compatible
- [ ] Test with actual ElectricSQL 1.1+ service

## Breaking Changes to Watch For

1. **Shape URL Format Changes**: Monitor for endpoint path changes
2. **Params Structure Changes**: Watch for new required fields or structure changes
3. **Hook API Changes**: Check for new required parameters or return type changes
4. **Type Definition Changes**: Verify TypeScript types remain compatible

## Migration Notes

If breaking changes are found:

1. Document the change in this file
2. Update compatibility tests
3. Update implementation code
4. Update type definitions
5. Test thoroughly before production

## Test Coverage

Compatibility tests are located in:
- `packages/sync/src/__tests__/compatibility/api-compatibility.test.ts`

Run tests with:
```bash
pnpm --filter @revealui/sync test compatibility
```

## References

- ElectricSQL Documentation: https://electric-sql.com/docs
- @electric-sql/react: https://www.npmjs.com/package/@electric-sql/react
- @electric-sql/client: https://www.npmjs.com/package/@electric-sql/client
