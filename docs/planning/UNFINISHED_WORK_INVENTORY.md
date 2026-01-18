# Unfinished Work Inventory

This document catalogs all unfinished work mentioned in documentation, comments, and code throughout the RevealUI codebase.

**Last Updated**: 2025-01-26  
**Total Items Found**: ~100+ items

---

## Table of Contents

1. [Critical TODOs](#critical-todos)
2. [Feature Implementations](#feature-implementations)
3. [Test Coverage](#test-coverage)
4. [Code Refactoring](#code-refactoring)
5. [Infrastructure & Phases](#infrastructure-phases)
6. [Documentation](#documentation)
7. [Type System](#type-system)
8. [API Verification](#api-verification)
9. [Build & Configuration](#build-configuration)
10. [Performance & Optimization](#performance-optimization)

---

## Critical TODOs

### Core Framework

1. **Populate Support (Phase 2)**
   - **Location**: `packages/core/src/core/instance/RevealUIInstance.ts:276`
   - **Code**: `populate: undefined, // TODO: Add populate support (from Phase 2)`
   - **Status**: Not implemented
   - **Priority**: High

2. **Populate Support (Global Operations)**
   - **Location**: `packages/core/src/core/globals/GlobalOperations.ts:108`
   - **Code**: `populate: undefined, // TODO: Add populate support (from Phase 2)`
   - **Status**: Not implemented
   - **Priority**: High

3. **TypeScript Types Fix**
   - **Location**: `apps/cms/next.config.mjs:21`
   - **Code**: `// TODO: Remove this once packages/core types are fully fixed`
   - **Status**: TypeScript errors being ignored during build
   - **Priority**: Medium

4. **Universal Middleware Replacement**
   - **Location**: `apps/web/src/server/create-todo-handler.ts:1`
   - **Code**: `// TODO: stop using universal-middleware and directly integrate server middlewares instead`
   - **Note**: Bati generates boilerplates that use universal-middleware. This is temporary.
   - **Status**: Pending removal
   - **Priority**: Medium

5. **Vercel API Integration**
   - **Location**: `apps/web/src/components/Builder.tsx:150`
   - **Code**: `// TODO: Implement Vercel API integration`
   - **Status**: Prototype feature, not yet implemented
   - **Priority**: Medium

### Validation & Utilities

6. **Additional Validation**
   - **Location**: `scripts/cohesion/utils/fixes.ts:248`
   - **Code**: `// TODO: Add more validation`
   - **Status**: Pending
   - **Priority**: Low

### Stripe Integration

7. **Multi-Instance Circuit Breaker State**
   - **Location**: `packages/services/src/core/stripe/stripeClient.ts:47`
   - **Code**: `// TODO: For multi-instance deployments, consider: Redis-backed circuit breaker state`
   - **Status**: Currently in-memory only, won't work across instances
   - **Priority**: Medium

### Memory System

8. **Vector Search Implementation**
   - **Location**: `packages/memory/src/core/memory/episodic-memory.ts:320`
   - **Code**: `// TODO: Implement vector search using pgvector`
   - **Status**: Currently returns all memories, no vector search
   - **Priority**: Medium

### ElectricSQL Integration

9. **Database Type After Generation**
   - **Location**: `packages/sync/src/schema.ts:211`
   - **Code**: `// TODO: After running \`pnpm dlx electric-sql generate\`, update this to:`
   - **Status**: Using fallback type, needs update after schema generation
   - **Priority**: Medium

---

## Feature Implementations

### Cohesion Engine

10. **Phase 3: Automated Cleanup**
    - **Location**: `scripts/cohesion/fix.ts`, `scripts/cohesion/README.md`
    - **Status**: ⚠️ Skeleton working, full implementation pending
    - **Details**: Framework in place but fix strategies not yet implemented
    - **Priority**: High
    - **Estimated Time**: Unknown

11. **Phase 4: Ralph Integration**
    - **Location**: `scripts/cohesion/README.md:17`
    - **Status**: ⏳ Pending
    - **Details**: Iterative improvement workflow, progress tracking
    - **Priority**: Medium

### Plugin System

12. **Plugin Integration into Vite Build**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:23`
    - **Status**: Plugin system created but not fully integrated
    - **Details**: Requires manual Vite plugin conversion
    - **Priority**: Medium

13. **Configuration Merging**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:29`
    - **Status**: Unified config system created but not fully integrated
    - **Details**: Works alongside existing `+config.ts` files
    - **Priority**: Low

### Rich Text Editor

14. **Client Components Implementation (Phase 2)**
    - **Location**: `packages/core/src/client/richtext-lexical/index.ts:49`
    - **Code**: `// Feature client components (implementations coming in Phase 2)`
    - **Status**: Pending Phase 2 implementation
    - **Priority**: Medium

### Builder Component

15. **Vercel Deployment Feature**
    - **Location**: `apps/web/src/components/Builder.tsx:150`
    - **Status**: Prototype feature, deployment not yet implemented
    - **Details**: Alert shows "Deploy functionality coming soon! 🚀"
    - **Priority**: Medium

16. **AI Features**
    - **Location**: `apps/web/src/components/Builder.tsx:283`
    - **Status**: Coming soon, requires API key configuration
    - **Priority**: Low

---

## Test Coverage

### Integration Tests - Pending Implementation

17. **useConversations Hook Tests**
    - **Location**: `packages/sync/src/__tests__/integration/useConversations.test.ts`
    - **Status**: ⏸️ Pending - requires React Testing Library setup
    - **Note**: Test file exists but tests are not implemented
    - **Priority**: Medium

18. **useAgentMemory Hook Tests**
    - **Location**: `packages/sync/src/__tests__/integration/useAgentMemory.test.ts`
    - **Status**: ⏸️ Pending - requires React Testing Library setup
    - **Note**: Test file exists but tests are not implemented
    - **Priority**: Medium

19. **useAgentContext Hook Tests**
    - **Location**: `packages/sync/src/__tests__/integration/useAgentContext.test.ts`
    - **Status**: ⏸️ Pending - requires React Testing Library setup
    - **Note**: Test file exists but tests are not implemented
    - **Priority**: Medium

### Integration Tests - Placeholder Tests

20. **Supabase Client Initialization Test**
    - **Location**: `packages/test/src/integration/services/supabase.integration.test.ts:21`
    - **Code**: `// TODO: Implement Supabase client initialization test`
    - **Status**: Placeholder test exists
    - **Priority**: Low

21. **Supabase Database Operations Tests**
    - **Location**: `packages/test/src/integration/services/supabase.integration.test.ts:28`
    - **Code**: `// TODO: Implement database operation tests`
    - **Status**: Placeholder test exists
    - **Priority**: Low

22. **Supabase Auth Operations Tests**
    - **Location**: `packages/test/src/integration/services/supabase.integration.test.ts:35`
    - **Code**: `// TODO: Implement auth operation tests`
    - **Status**: Placeholder test exists
    - **Priority**: Low

23. **Stripe Payment Intent Creation Test**
    - **Location**: `packages/test/src/integration/services/stripe.integration.test.ts:22`
    - **Code**: `// TODO: Implement with actual Stripe API when test keys are available`
    - **Status**: Placeholder test exists
    - **Priority**: Low

24. **Stripe Webhook Signature Verification Test**
    - **Location**: `packages/test/src/integration/services/stripe.integration.test.ts:30`
    - **Code**: `// TODO: Implement webhook signature verification test`
    - **Status**: Placeholder test exists
    - **Priority**: Low

25. **Stripe Checkout Session Creation Test**
    - **Location**: `packages/test/src/integration/services/stripe.integration.test.ts:37`
    - **Code**: `// TODO: Implement checkout session creation test`
    - **Status**: Placeholder test exists
    - **Priority**: Low

26. **Stripe Subscription Creation Test**
    - **Location**: `packages/test/src/integration/services/stripe.integration.test.ts:44`
    - **Code**: `// TODO: Implement subscription creation test`
    - **Status**: Placeholder test exists
    - **Priority**: Low

### Test Coverage Thresholds

27. **Test Coverage Not at Thresholds**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:64`
    - **Status**: Coverage thresholds set (70%/60%/70%) but not yet met
    - **Priority**: Medium

28. **E2E Test Coverage**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:70`
    - **Status**: Basic E2E tests implemented, limited to critical user flows
    - **Priority**: Low

---

## Code Refactoring

### File Splitting - Critical

29. **CollectionOperations.ts File Splitting**
    - **Location**: `packages/core/src/core/collections/CollectionOperations.ts`
    - **Status**: ⏳ PENDING - Currently 520-530 lines, target ~150 lines
    - **Priority**: 🔴 CRITICAL
    - **Estimated Time**: 3-4 hours
    - **References**: Multiple assessment documents mention this as incomplete

30. **RevealUIInstance.ts File Splitting**
    - **Location**: `packages/core/src/core/instance/RevealUIInstance.ts`
    - **Status**: ⏳ PENDING - Currently 455-456 lines, target ~150 lines
    - **Priority**: 🔴 CRITICAL
    - **Estimated Time**: 2-3 hours
    - **References**: Multiple assessment documents mention this as incomplete

### Incomplete Extraction

31. **serializeJsonFields Not Fully Used**
    - **Location**: `packages/core/src/core/instance/RevealUIInstance.ts`
    - **Status**: ⚠️ INCOMPLETE - Not used in `update()` method
    - **Priority**: Medium
    - **Details**: Function extracted but not fully integrated

---

## Infrastructure & Phases

### Cohesion Engine Phases

32. **Phase 3: Automated Cleanup (Full Implementation)**
    - **Location**: `scripts/cohesion/README.md:92`
    - **Status**: Skeleton working, full implementation pending
    - **Tasks**:
      - Type assertion removal
      - Import standardization
      - Pattern extraction (create utilities)
      - Configuration fixes
    - **Priority**: High

33. **Phase 4: Ralph Integration**
    - **Location**: `scripts/cohesion/README.md:99`
    - **Status**: Pending
    - **Tasks**:
      - Iterative improvement workflow
      - Progress tracking
      - Incremental fixes
      - Completion detection
    - **Priority**: Medium

### Various Phases Mentioned in Documentation

34. **Multiple Phase References**
    - Many documentation files reference "Phase 1", "Phase 2", etc. that may or may not be complete
    - See grep results for all Phase references across the codebase

---

## Documentation

35. **API Documentation Edge Cases**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:90`
    - **Status**: Core APIs documented, some edge cases not covered
    - **Priority**: Low

36. **Migration Guides - Step-by-Step Examples**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:95`
    - **Status**: Basic guides created, step-by-step examples needed
    - **Priority**: Low

37. **Interactive Migration Tool**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:96`
    - **Status**: Future improvement
    - **Priority**: Low

---

## Type System

38. **Complete Elimination of `any` Types**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:112`
    - **Status**: Reduced from 297 to ~18 instances in core files
    - **Priority**: Medium

39. **Enhanced RevealUI CMS Type Inference**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:114`
    - **Status**: Complex types map to `unknown[]` or `Record<string, unknown>`
    - **Priority**: Medium

40. **Complete Type Definitions for File Types**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:12`
    - **Status**: Future improvement
    - **Priority**: Low

---

## API Verification

### ElectricSQL API - Critical Unverified Assumptions

⚠️ **CRITICAL WARNING**: The ElectricSQL integration contains unverified API assumptions. See `packages/sync/API_ASSUMPTIONS.md` for details.

41. **Shape Query API Endpoint**
    - **Location**: `packages/sync/src/client/index.ts`, `packages/sync/API_ASSUMPTIONS.md`
    - **Assumed**: `/v1/shape?table=agent_contexts&agent_id=123`
    - **Reality**: Unknown - format might be completely different
    - **Risk**: HIGH - Shape subscriptions may not work
    - **Priority**: 🔴 CRITICAL

42. **Mutation Endpoints (REST)**
    - **Location**: Multiple files in `packages/sync/src/hooks/`
    - **Assumed**: REST endpoints like `/v1/agent_contexts/{id}` (PUT/POST/DELETE)
    - **Reality**: Unknown - ElectricSQL might not expose REST endpoints at all
    - **Risk**: CRITICAL - All CRUD operations will fail if wrong
    - **Priority**: 🔴 CRITICAL

43. **Query Parameters Format**
    - **Location**: `packages/sync/src/hooks/`
    - **Assumed**: Simple query params like `agent_id=123&session_id=456`
    - **Reality**: Might need structured WHERE clauses or different format
    - **Risk**: HIGH - Filtering won't work correctly
    - **Priority**: 🔴 CRITICAL

44. **Authorization Header Format**
    - **Location**: `packages/sync/src/client/index.ts`
    - **Assumed**: `Authorization: Bearer {token}`
    - **Reality**: Might need different format
    - **Risk**: MEDIUM - Auth might not work
    - **Priority**: Medium

**Action Required**: Verify all ElectricSQL API endpoints before production use.

---

## Build & Configuration

45. **Watch Mode - File System Watchers**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:38`
    - **Status**: Currently using polling (2-second interval), not file system watchers
    - **Future**: Migrate to chokidar for better performance
    - **Priority**: Low

46. **Bundle Size Optimization**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:54`
    - **Status**: Current ~45MB (includes source maps), 6.6 MB compressed
    - **Future**: Tree-shaking improvements, code splitting
    - **Priority**: Medium

47. **Parallel Builds & Caching**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:59`
    - **Status**: Current build time ~8-12 seconds
    - **Future**: Parallel builds, caching improvements
    - **Priority**: Low

---

## Performance & Optimization

48. **PostgreSQL JSONB Not Implemented**
    - **Location**: Multiple assessment documents
    - **Status**: Currently using TEXT only, JSONB recommended but not implemented
    - **Priority**: Medium
    - **Details**: Deferred to "future"

---

## Compliance & Accessibility

49. **GDPR - Configurable Retention Policies**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:79`
    - **Status**: Data retention policies not configurable
    - **Priority**: Low

50. **WCAG 2.1 - ARIA Labels Audit**
    - **Location**: `docs/KNOWN-LIMITATIONS.md:84`
    - **Status**: Not all components have ARIA labels
    - **Priority**: Medium

---

## Known Issues & Regressions

### Documented but Not Fixed

51. **console.warn Regression**
    - **Location**: Multiple assessment documents mention this
    - **Status**: ❌ NOT FIXED - Should use proper logger instead of `console.warn`
    - **Fix Time**: 2 minutes
    - **Priority**: Medium
    - **Details**: Has been documented for months but not fixed

52. **Type Safety Issues**
    - **Location**: Various files
    - **Status**: Multiple TypeScript errors are pre-existing and should be addressed
    - **Priority**: Medium

53. **Circular Dependencies**
    - **Location**: Build system
    - **Status**: Documented but should be refactored
    - **Priority**: Low

---

## Summary by Priority

### 🔴 Critical (Must Fix Before Production)

- CollectionOperations.ts file splitting (530 lines → ~150)
- RevealUIInstance.ts file splitting (456 lines → ~150)
- ElectricSQL API verification (all endpoints)
- Phase 3: Automated Cleanup (full implementation)

### 🟡 High Priority

- Populate support (Phase 2)
- Vector search implementation (pgvector)
- Hook tests implementation (React Testing Library setup)
- Circuit breaker state for multi-instance deployments

### 🟢 Medium Priority

- Vercel API integration
- TypeScript types fixes
- Universal middleware replacement
- Test coverage thresholds
- Plugin system integration
- Bundle size optimization

### ⚪ Low Priority

- Additional validation
- AI features in Builder
- E2E test expansion
- Documentation improvements
- Various Phase implementations
- Performance optimizations

---

## Notes

- Many items are documented in assessment files but may have already been addressed
- Some TODOs may be intentionally deferred to future versions
- The ElectricSQL API assumptions are the most critical outstanding issue
- File splitting is a major refactoring task that has been pending for months
- Several test files have placeholder tests that should be implemented or removed

---

## References

- `docs/KNOWN-LIMITATIONS.md` - Official limitations document
- `packages/sync/API_ASSUMPTIONS.md` - ElectricSQL API assumptions
- `scripts/cohesion/README.md` - Cohesion engine status
- `docs/archive/assessments/` - Multiple assessment documents with incomplete work tracking

## Related Documentation

- [Prioritized Action Plan](./PRIORITIZED_ACTION_PLAN.md) - Project action plan
- [Product Service Completion Plan](./PRODUCT_SERVICE_COMPLETION_PLAN.md) - Product service roadmap
- [Known Limitations](../development/KNOWN-LIMITATIONS.md) - Current limitations
- [Status Dashboard](../STATUS.md) - Current project state
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task
