# Lint Errors Report

**Generated on:** December 30, 2025  
**Total Issues:** 414 (376 errors, 38 warnings)  
**Auto-fixable:** 1 error

This report systematically categorizes all linting errors found across the RevealUI project. Each category contains specific files and line numbers where issues occur, allowing for methodical resolution.

## Summary by Category

| Category | Errors | Warnings | Total |
|----------|--------|----------|-------|
| Import/Module Resolution | 70 | 0 | 70 |
| TypeScript Type Safety | 88 | 15 | 103 |
| Code Quality & Style | 58 | 0 | 58 |
| Accessibility | 13 | 0 | 13 |
| Promise/Async Handling | 11 | 0 | 11 |
| Environment/Globals | 136 | 0 | 136 |
| Control Flow | 0 | 3 | 3 |
| **TOTAL** | **376** | **38** | **414** |

---

## 🔍 Import/Module Resolution Issues (70 errors)

### Missing Module Imports
These files have imports that cannot be resolved, likely due to missing files, incorrect paths, or build configuration issues.

**apps/web/src/app/page.tsx**
- Line 1: Unable to resolve path to module '../components/Builder'

**packages/ai/src/hooks/index.ts** (4 errors)
- Line 1: Unable to resolve path to module './useRevealUIAI'
- Line 2: Unable to resolve path to module './useAIStreaming'
- Line 3: Unable to resolve path to module './useAIPrompt'
- Line 4: Unable to resolve path to module './useMCP'

**packages/ai/src/hooks/useAIPrompt.ts**
- Line 8: Unable to resolve path to module '../primitives/core.js'

**packages/ai/src/hooks/useAIStreaming.ts**
- Line 8: Unable to resolve path to module '../primitives/core.js'

**packages/ai/src/hooks/useMCP.ts**
- Line 9: Unable to resolve path to module '../mcp/index.js'

**packages/ai/src/hooks/useRevealUIAI.ts**
- Line 8: Unable to resolve path to module '../primitives/core.js'

**packages/ai/src/index.ts** (4 errors)
- Line 2: Unable to resolve path to module './primitives'
- Line 3: Unable to resolve path to module './hooks'
- Line 4: Unable to resolve path to module './utils'
- Line 5: Unable to resolve path to module './mcp'

**packages/ai/src/memory/index.ts**
- Line 1: Unable to resolve path to module './CRDTMemoryManager'

**packages/ai/src/primitives/components.tsx**
- Line 8: Unable to resolve path to module './core.js'

**packages/ai/src/primitives/index.ts** (2 errors)
- Line 2: Unable to resolve path to module './core'
- Line 3: Unable to resolve path to module './components'

**packages/ai/src/utils/index.ts** (3 errors)
- Line 1: Unable to resolve path to module './config'
- Line 2: Unable to resolve path to module './validation'
- Line 3: Unable to resolve path to module './formatting'

**packages/memory-core/src/conflict/TimestampResolver.ts**
- Line 3: Unable to resolve path to module './ConflictResolver'

**packages/memory-core/src/crdt/base/BaseCRDT.ts**
- Line 4: Unable to resolve path to module './VectorClock'

**packages/memory-core/src/crdt/counters/PNCounter.ts** (2 errors)
- Line 2: Unable to resolve path to module '../base/BaseCRDT'
- Line 4: Unable to resolve path to module '../base/VectorClock'

**packages/memory-core/src/crdt/registers/LWWRegister.ts** (2 errors)
- Line 2: Unable to resolve path to module '../base/BaseCRDT'
- Line 5: Unable to resolve path to module '../base/VectorClock'

**packages/memory-core/src/crdt/sets/ORSet.ts** (2 errors)
- Line 2: Unable to resolve path to module '../base/BaseCRDT'
- Line 4: Unable to resolve path to module '../base/VectorClock'

**packages/memory-core/src/index.ts** (9 errors)
- Line 2: Unable to resolve path to module './crdt/base/BaseCRDT'
- Line 3: Unable to resolve path to module './crdt/base/VectorClock'
- Line 4: Unable to resolve path to module './crdt/base/CRDTTypes'
- Line 7: Unable to resolve path to module './crdt/registers/LWWRegister'
- Line 8: Unable to resolve path to module './crdt/sets/ORSet'
- Line 9: Unable to resolve path to module './crdt/counters/PNCounter'
- Line 12: Unable to resolve path to module './conflict/ConflictResolver'
- Line 13: Unable to resolve path to module './conflict/TimestampResolver'
- Line 16: Unable to resolve path to module './store/MemoryStore'

**packages/memory-core/src/store/MemoryStore.ts** (3 errors)
- Line 4: Unable to resolve path to module '../crdt/counters/PNCounter'
- Line 5: Unable to resolve path to module '../crdt/registers/LWWRegister'
- Line 6: Unable to resolve path to module '../crdt/sets/ORSet'

**packages/memory-core/tests/crdt/counters/PNCounter.test.ts** (2 errors)
- Line 1: Unable to resolve path to module '../../../src/conflict/TimestampResolver'
- Line 2: Unable to resolve path to module '../../../src/crdt/counters/PNCounter'

**packages/memory-core/tests/crdt/registers/LWWRegister.test.ts** (2 errors)
- Line 1: Unable to resolve path to module '../../../src/conflict/TimestampResolver'
- Line 2: Unable to resolve path to module '../../../src/crdt/registers/LWWRegister'

**packages/memory-core/tests/crdt/sets/ORSet.test.ts** (2 errors)
- Line 1: Unable to resolve path to module '../../../src/conflict/TimestampResolver'
- Line 2: Unable to resolve path to module '../../../src/crdt/sets/ORSet'

**packages/memory-core/tests/performance/CRDTPerformance.test.ts** (2 errors)
- Line 1: Unable to resolve path to module '../../src'
- Line 2: Unable to resolve path to module '../../src/conflict/TimestampResolver'

### Duplicate Imports
**apps/web/src/app/api/mcp/route.ts**
- Line 18: '@revealui/ai' import is duplicated

**apps/web/src/components/Builder.tsx**
- Line 4: 'react' import is duplicated

**packages/ai/src/hooks/useMCP.ts**
- Line 9: '../mcp/index.js' import is duplicated

**packages/memory-core/src/crdt/registers/LWWRegister.ts**
- Line 4: '../base/CRDTTypes' import is duplicated

---

## 🛡️ TypeScript Type Safety Issues (103 total: 88 errors, 15 warnings)

### Explicit Any Usage (15 warnings)
These warnings indicate places where `any` type is used instead of specific types.

**apps/web/src/components/MCPDemo.tsx** (4 warnings)
- Line 12, 13, 14, 44: Unexpected any. Specify a different type

**packages/ai/src/hooks/useAIPrompt.ts**
- Line 79: Unexpected any. Specify a different type

**packages/ai/src/hooks/useMCP.ts** (6 warnings)
- Line 18, 19, 22, 23, 26, 27: Unexpected any. Specify a different type

**packages/ai/src/hooks/useRevealUIAI.ts**
- Line 42: Unexpected any. Specify a different type

**packages/ai/src/mcp/index.ts**
- Line 39: Unexpected any. Specify a different type

**packages/ai/src/primitives/core.ts**
- Line 41, 116: Unexpected any. Specify a different type

**packages/ai/src/primitives/types.ts** (8 warnings)
- Line 11, 17, 40, 41, 53, 60: Unexpected any. Specify a different type

**packages/builder/src/types.ts**
- Line 9: Unexpected any. Specify a different type

**packages/memory-core/src/crdt/base/CRDTTypes.ts** (3 warnings)
- Line 14, 20, 48: Unexpected any. Specify a different type

**packages/memory-core/src/store/MemoryStore.ts** (3 warnings)
- Line 36, 50, 65: Unexpected any. Specify a different type

### Unsafe Operations (88 errors)
These errors indicate potentially unsafe type operations that could lead to runtime errors.

**Unsafe Assignments (22 errors)**
- apps/web/src/app/api/mcp/route.ts (1): Line 138
- apps/web/src/components/MCPDemo.tsx (10): Lines 14, 15, 52, 64, 76, 88, 117, 151, 190
- packages/ai/src/primitives/components.tsx (1): Line 55
- packages/ai/src/utils/formatting.ts (1): Line 85
- packages/memory-core/src/crdt/registers/LWWRegister.ts (1): Line 51
- packages/memory-core/src/store/MemoryStore.ts (3): Lines 53, 55, 57
- scripts/build.ts (2): Lines 37, 41
- scripts/quality.ts (2): Lines 43, 47
- scripts/quality.ts (1): Line 91

**Unsafe Calls (12 errors)**
- apps/web/src/app/api/mcp/route.ts (2): Lines 66, 69
- packages/ai/src/utils/formatting.ts (10): Lines 84, 85, 86, 87, 89, 89, 89, 92, 92, 92

**Unsafe Member Access (54 errors)**
- apps/web/src/app/api/mcp/route.ts (2): Lines 66, 69
- apps/web/src/components/MCPDemo.tsx (8): Lines 89, 151, 151, 152, 190, 190, 191, 191
- packages/ai/src/primitives/components.tsx (1): Line 55
- packages/ai/src/utils/formatting.ts (33): Lines 84-92 (multiple instances)
- packages/memory-core/tests/crdt/counters/PNCounter.test.ts (4): Lines 15, 18, 26, 31, 32, 40, 41
- packages/memory-core/tests/crdt/registers/LWWRegister.test.ts (4): Lines 16, 17, 26, 36, 45, 46
- packages/memory-core/tests/crdt/sets/ORSet.test.ts (4): Lines 15, 16, 19, 20, 28, 29, 30, 40, 48, 49
- packages/memory-core/tests/performance/CRDTPerformance.test.ts (2): Lines 18, 34, 50
- scripts/build.ts (2): Lines 37, 41
- scripts/quality.ts (2): Lines 43, 47
- scripts/quality.ts (1): Line 91

### Template Expression Restrictions (2 errors)
**packages/ai/src/mcp/index.ts**
- Line 79, 97: Invalid type "never" of template literal expression

---

## ✨ Code Quality & Style Issues (58 errors)

### Nullish Coalescing Preference (37 errors)
These suggest using `??` instead of `||` for safer null/undefined checks.

**apps/web/src/components/Builder.tsx** (5): Lines 41, 83, 91, 144, 145
**apps/web/src/components/MCPDemo.tsx** (5): Lines 29, 33, 34, 57, 89
**packages/ai/src/primitives/core.ts** (6): Lines 46, 47, 48, 82, 83, 83
**packages/ai/src/utils/config.ts** (8): Lines 17, 19, 19, 24, 25, 26, 27
**packages/ai/src/utils/formatting.ts** (3): Lines 159, 160, 161
**packages/builder/src/useBuilder.ts** (2): Lines 17, 31
**packages/memory-core/src/crdt/base/VectorClock.ts** (4): Lines 13, 14, 21, 26
**packages/memory-core/src/crdt/sets/ORSet.ts** (3): Lines 45, 73, 83
**packages/presentation/src/Image.tsx** (1): Line 17
**scripts/build.ts** (3): Lines 28, 51, 55
**scripts/deploy.ts** (1): Line 13
**scripts/mcp-stripe.ts** (1): Line 35
**scripts/quality.ts** (1): Line 62

### Unused Variables (14 errors)
**apps/web/src/components/Builder.tsx** (2): Lines 25, 25
**packages/memory-core/src/crdt/registers/LWWRegister.ts** (1): Line 4
**scripts/build.ts** (1): Line 33
**scripts/setup-mcp.ts** (3): Lines 3, 3, 18

### Require Await (7 errors)
**apps/web/src/components/Builder.tsx** (1): Line 139
**packages/ai/src/memory/CRDTMemoryManager.ts** (3): Lines 46, 57, 66
**packages/memory-core/tests/setup.ts** (2): Lines 5, 9
**scripts/quality.ts** (1): Line 74

### Other Style Issues (0 errors)

---

## ♿ Accessibility Issues (13 errors)

**apps/web/src/components/Builder.tsx** (8 errors)
- Line 61: Visible, non-interactive elements must have keyboard listeners
- Line 61: Avoid non-native interactive elements
- Line 81: Visible, non-interactive elements must have keyboard listeners
- Line 81: Non-interactive elements should not be assigned mouse/keyboard event listeners
- Line 91: Visible, non-interactive elements must have keyboard listeners
- Line 91: Avoid non-native interactive elements
- Line 200, 209, 213, 222, 227: Form labels must be associated with controls

**packages/ai/src/primitives/components.tsx** (5 errors)
- Line 140, 180, 194, 207, 220: Form labels must be associated with controls

---

## 🔄 Promise/Async Handling Issues (11 errors)

### Floating Promises (4 errors)
**packages/ai/src/hooks/useMCP.ts** (2): Lines 106, 112
**packages/ai/src/primitives/components.tsx** (1): Line 138
**packages/ai/src/primitives/core.ts** (1): Line 79

### Misused Promises (6 errors)
**apps/web/src/components/Builder.tsx** (1): Line 187
**apps/web/src/components/MCPDemo.tsx** (4): Lines 117, 130, 137, 150, 171, 178
**packages/ai/src/primitives/components.tsx** (1): Line 132

### Await Thenable (2 errors)
**packages/ai/src/hooks/useMCP.ts** (2): Lines 48, 63

### Confusing Void Expression (2 errors)
**packages/ai/src/hooks/useMCP.ts** (2): Lines 48, 63

---

## 🌍 Environment/Globals Issues (136 errors)

These are primarily in test files where globals like `describe`, `test`, `expect`, `beforeEach`, `console`, `performance` are not defined. This is common in test environments that need proper configuration.

**packages/memory-core/tests/crdt/counters/PNCounter.test.ts** (20 errors)
**packages/memory-core/tests/crdt/registers/LWWRegister.test.ts** (18 errors)
**packages/memory-core/tests/crdt/sets/ORSet.test.ts** (22 errors)
**packages/memory-core/tests/performance/CRDTPerformance.test.ts** (12 errors)

**Undefined imports in scripts:**
**scripts/quality.ts** (1): Line 91 - 'require' is not defined

---

## ⚡ Control Flow Issues (3 warnings)

### Unnecessary Conditions (2 errors)
**apps/web/src/app/api/mcp/route.ts** (1): Line 69
**packages/ai/src/mcp/index.ts** (2): Lines 157, 219
**packages/ai/src/utils/validation.ts** (1): Line 67

### Unreachable Code (1 error)
**packages/ai/src/primitives/core.ts** (1): Line 105

---

## 📋 Resolution Priority & Strategy

### Phase 1: Critical Infrastructure (Import Resolution)
1. **Fix missing module imports** - These prevent compilation and must be addressed first
2. **Resolve duplicate imports** - Clean up import statements
3. **Fix TypeScript path mappings** - Ensure proper module resolution

### Phase 2: Type Safety (High Priority)
1. **Replace explicit `any` types** with proper type definitions
2. **Fix unsafe operations** - Add proper type guards and assertions
3. **Resolve template expression restrictions**

### Phase 3: Code Quality (Medium Priority)
1. **Convert `||` to `??`** for safer null checks
2. **Remove unused variables** or properly use them
3. **Add missing await expressions** where required

### Phase 4: User Experience (Medium Priority)
1. **Fix accessibility issues** - Ensure proper keyboard navigation and form labels
2. **Resolve promise handling** - Properly await or handle promises

### Phase 5: Testing & Environment (Low Priority)
1. **Configure test globals** - Set up proper test environment
2. **Fix environment-specific globals**

### Phase 6: Edge Cases (Low Priority)
1. **Remove unreachable code**
2. **Fix unnecessary conditions**

---

## 🔧 Auto-fixable Issues

**Only 1 error can be auto-fixed:**
- Import sorting in `apps/web/src/app/api/mcp/route.ts`

---

## 📊 Progress Tracking

Use this table to track resolution progress:

| Phase | Category | Status | Issues Resolved | Remaining | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| 1 | Import/Module Resolution | ⏳ Pending | 0/70 | 70 | Critical for compilation |
| 2 | TypeScript Type Safety | ⏳ Pending | 0/103 | 103 | High impact on reliability |
| 3 | Code Quality & Style | ⏳ Pending | 0/58 | 58 | Medium priority |
| 4 | Accessibility | ⏳ Pending | 0/13 | 13 | User experience |
| 5 | Promise/Async Handling | ⏳ Pending | 0/11 | 11 | Async reliability |
| 6 | Environment/Globals | ⏳ Pending | 0/136 | 136 | Test environment setup |
| 7 | Control Flow | ⏳ Pending | 0/3 | 3 | Edge cases |

**Total Progress:** 0/414 issues resolved (0%)

---

*This report was generated automatically from lint output. Update this file as issues are resolved to track progress.*
