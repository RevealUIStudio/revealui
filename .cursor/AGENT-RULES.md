# Agent Developer Rules

**Status**: 🔴 **MANDATORY - ENFORCED**  
**Last Updated**: January 2025

## Rule #1: Legacy Code Removal (TOP PRIORITY)

**ALL IMPLEMENTATIONS MUST BE CURRENT. LEGACY/DEPRECATED CODE MUST BE REFACTORED TO USE NEW IMPLEMENTATIONS AND OLD CODE REMOVED.**

This is the **#1 priority** for every agent interaction. See `LEGACY-CODE-REMOVAL-POLICY.md` for details.

### Before Every Change:

1. Search for deprecated/legacy code in the affected area
2. Identify new implementations that should be used
3. Refactor all code to use new implementations
4. Remove all old/deprecated code
5. Verify no references to old code remain

### Never:

- ❌ Leave old code "for backward compatibility"
- ❌ Create compatibility layers
- ❌ Mark code as deprecated without removing it
- ❌ Defer legacy code removal "for later"

### Always:

- ✅ Remove old code immediately
- ✅ Refactor all call sites in the same change
- ✅ Use only current implementations
- ✅ Remove deprecated code as part of every change

## Rule #2: No Backward Compatibility

- Do not maintain old code paths
- Do not add compatibility layers
- Do not keep deprecated functions
- All code must use current implementations only

## Rule #3: Immediate Migration

When new implementations are created:

1. Find all usages of old code
2. Refactor all call sites
3. Remove old code
4. All in the same PR/commit

## Rule #4: Code Quality

- No `as any` type assertions
- No `@ts-ignore` comments
- Proper error handling
- Input validation
- TypeScript strict mode

## Rule #5: Testing

- Write tests for new code
- Update tests when refactoring
- Remove tests for removed code
- All tests must pass

## Rule #6: Documentation

- Update docs when removing code
- Document migration paths
- Remove references to old code
- Keep docs current

## Enforcement

**Every agent interaction must follow these rules. No exceptions.**

If you find legacy code, you MUST refactor it as part of your current task. Do not create separate migration tasks. Do not defer removal.

---

**See Also**: `LEGACY-CODE-REMOVAL-POLICY.md` for detailed policy.
