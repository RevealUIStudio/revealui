# 🧪 TEST IMPLEMENTATION: [TEST_TYPE]
**Phase Description**: Implementing [unit/integration/e2e] tests for [component/feature/module]

---

## 📋 TASK CONTEXT

### Project Overview
**Framework**: RevealUI (React 19 + Next.js 16 enterprise framework)
**Testing Stack**: Vitest, React Testing Library, Playwright (e2e)
**Architecture**: Monorepo with pnpm workspaces

### Current State
**Test File**: [path to test file being created/modified]
**Source File**: [path to component/feature being tested]
**Existing Tests**: [related test files or test patterns]

---

## 🎯 TEST SPECIFICATION

### Objective
[Write tests that verify X functionality/behavior with Y coverage]

### Test Cases (MUST HAVE)
- [ ] [Core functionality test case]
- [ ] [Edge case test case]
- [ ] [Error handling test case]
- [ ] [Integration test case]

### Test Coverage Goals
- [ ] Statement coverage: [target %]
- [ ] Branch coverage: [target %]
- [ ] Function coverage: [target %]

---

## 🔧 TEST IMPLEMENTATION

### Test Structure
```typescript
describe('[Component/Feature Name]', () => {
  describe('[Behavior Group]', () => {
    it('should [expected behavior]', async () => {
      // Arrange
      [setup test data/fixtures]

      // Act
      [execute the code under test]

      // Assert
      [verify expected outcomes]
    })
  })
})
```

### Test Patterns to Follow
**Mocking**: Use `vi.mock()` for external dependencies, `vi.fn()` for spies
**Async Testing**: Use `await` with async test functions, no `done` callbacks
**DOM Testing**: React Testing Library queries over direct DOM manipulation
**Setup/Teardown**: `beforeEach`/`afterEach` for test isolation

### Test Data/Fixtures
```typescript
// Test fixtures
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User'
}

// Factory functions for test data
const createMockProps = (overrides = {}) => ({
  user: mockUser,
  onSubmit: vi.fn(),
  ...overrides
})
```

---

## 🚫 TESTING CONSTRAINTS

### Forbidden Patterns
- ❌ Direct DOM manipulation (use RTL queries)
- ❌ `done` callbacks (use async/await)
- ❌ Global test state without cleanup
- ❌ Testing implementation details
- ❌ Slow/flaky tests

### Required Patterns
- ✅ Arrange-Act-Assert structure
- ✅ Descriptive test names (`it('should...')`)
- ✅ Isolated test cases
- ✅ Fast, deterministic tests
- ✅ Accessibility testing where applicable

---

## 🧪 TEST VALIDATION

### Verification Steps
1. **Run Tests**: `pnpm test [specific test file]`
2. **Coverage**: `pnpm test:coverage` (check coverage report)
3. **Lint**: `pnpm lint` (test files)
4. **Type Check**: `pnpm typecheck`

### Expected Results
- [ ] All tests pass
- [ ] Coverage meets targets
- [ ] No console errors/warnings
- [ ] Fast execution (< 100ms per test)

---

## 🔄 TESTING LIFECYCLE

### Current Phase: [Writing Tests | Debugging Tests | Optimizing Tests]
**Status**: [Not Started | In Progress | Ready for Review]

### Test Strategy
1. **Unit Tests**: Test individual functions/components in isolation
2. **Integration Tests**: Test component interactions and API calls
3. **E2E Tests**: Test complete user workflows (if applicable)

### Next Phase Actions
1. **Immediate Next**: [Write additional test cases / Debug failing tests / Add coverage]
2. **Validation**: [Run test suite / Check coverage / Manual verification]
3. **Success Metrics**: [All tests pass / Coverage targets met / Fast execution]

---

## 📚 REFERENCE & TESTING PATTERNS

### Existing Test Examples
- [Similar test file]: [Location and pattern to follow]
- [Test utilities]: `packages/test/src/utils/`

### Testing Documentation
- [RTL docs]: https://testing-library.com/docs/react-testing-library/intro/
- [Vitest docs]: https://vitest.dev/
- [Playwright docs]: https://playwright.dev/

---

## 🎯 SUCCESS CRITERIA

**Test Implementation Complete When**:
1. All specified test cases implemented and passing
2. Coverage targets met or exceeded
3. No linting errors in test files
4. Tests run fast and deterministically
5. Code review approved

**Definition of Done**:
- [ ] Tests committed with descriptive commit message
- [ ] CI/CD passes with new tests
- [ ] Coverage report updated
- [ ] Test documentation updated if needed

---

## 📝 TESTING NOTES

[Test-specific notes, edge cases to consider, gotchas, or important testing reminders]

---

**USAGE**: Fill in bracketed sections with test-specific details before providing to AI assistant.