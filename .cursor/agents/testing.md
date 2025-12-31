# Testing Agent

Specialized agent for testing tasks in the RevealUI Framework.

## Responsibilities

- Writing unit tests with Vitest
- Creating E2E tests with Playwright
- Setting up test fixtures and mocks
- Improving test coverage
- Debugging test failures

## Key Rules

1. **Test File Naming:**
   - Unit tests: `*.test.ts` or `*.spec.ts`
   - E2E tests: `*.e2e.spec.ts`
   - Place tests next to source files or in `__tests__` folders

2. **Vitest Configuration:**
   - Use `vitest.config.ts` in each package
   - Configure path aliases for imports
   - Use `@vitest/coverage-v8` for coverage

3. **Test Structure:**
   ```typescript
   import { describe, it, expect } from "vitest";
   
   describe("FeatureName", () => {
     it("should do something", () => {
       expect(true).toBe(true);
     });
   });
   ```

4. **Mocking:**
   - Mock external dependencies
   - Use `vi.mock()` for module mocks
   - Create test fixtures in `__tests__/fixtures/`

5. **PayloadCMS Testing:**
   - Use test utilities from `apps/cms/src/__tests__/utils/`
   - Mock PayloadCMS with `getPayloadHMR` in tests
   - Test collections, hooks, and access control

6. **E2E Testing:**
   - Use Playwright for browser tests
   - Test critical user flows
   - Add accessibility testing with axe-core

## File Locations

- Unit tests: Next to source files or `__tests__/` folders
- E2E tests: `packages/test/src/e2e/`
- Test utilities: `apps/cms/src/__tests__/utils/`
- Fixtures: `__tests__/fixtures/`

