# How to Verify Agent Claims Independently

**Purpose**: Practical guide for verifying agent work without trusting status reports

---

## Quick Verification Checklist

### ✅ Test Execution
```bash
# Run all tests for a specific package
# Note: Package name is @revealui/core
pnpm test --filter @revealui/core

# Run specific test files
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core

# Check test count matches claims
pnpm test --filter @revealui/core 2>&1 | grep -E "Tests.*passed|Tests.*failed"
```

### ✅ Code Coverage
```bash
# Generate coverage report
pnpm test:coverage --filter @revealui/core

# Check coverage thresholds met
# Open coverage/index.html and verify files are covered
```

### ✅ Build Verification
```bash
# Ensure code compiles
pnpm build --filter @revealui/core

# Type checking
pnpm typecheck --filter @revealui/core
```

### ✅ File Existence Checks
```bash
# Verify test files exist
ls -la packages/revealui/src/core/__tests__/
# Should see: checkDependencies.test.ts, findGlobal.test.ts, fieldTraversal.test.ts

# Verify implementation files exist
ls -la packages/revealui/src/core/
# Should see: fieldTraversal.ts, revealui.ts (with implementations)
```

### ✅ Code Review
```bash
# Check if functions are implemented (not just stubs)
grep -A 20 "export.*function checkDependencies" packages/revealui/src/core/revealui.ts
grep -A 50 "async findGlobal" packages/revealui/src/core/revealui.ts

# Check if tests actually test the code
grep -A 5 "describe.*checkDependencies" packages/revealui/src/core/__tests__/checkDependencies.test.ts
grep -A 5 "describe.*findGlobal" packages/revealui/src/core/__tests__/findGlobal.test.ts
```

---

## Specific Verification Steps

### 1. Verify "All Tests Passing" Claim

**Command:**
```bash
cd /home/joshua-v-dev/projects/RevealUI
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core
```

**What to Check:**
- Exit code is 0 (success)
- Test count matches claim (e.g., "41 tests")
- No failed tests in output
- All test files show "passed"

**Red Flags:**
- Exit code non-zero
- "Tests failed" in output
- Test count doesn't match claim
- Skipped tests that should run

---

### 2. Verify "Implementation Complete" Claim

**Step 1: Check function exists**
```bash
grep -n "export.*function checkDependencies" packages/revealui/src/core/revealui.ts
grep -n "async findGlobal" packages/revealui/src/core/revealui.ts
```

**Step 2: Check it's not just a stub**
```bash
# Check for TODO/FIXME comments
grep -A 30 "async findGlobal" packages/revealui/src/core/revealui.ts | grep -E "TODO|FIXME|throw.*not implemented"

# Check for actual implementation (not just throwing error)
grep -A 30 "async findGlobal" packages/revealui/src/core/revealui.ts | grep -v "throw.*not implemented" | head -20
```

**Step 3: Verify it matches type definition**
```bash
# Check type definition exists
grep -A 10 "findGlobal.*:" packages/revealui/src/core/types/index.ts
```

---

### 3. Verify "Test Coverage Complete" Claim

**Step 1: Check test files exist**
```bash
test -f packages/revealui/src/core/__tests__/checkDependencies.test.ts && echo "✓ Exists" || echo "✗ Missing"
test -f packages/revealui/src/core/__tests__/findGlobal.test.ts && echo "✓ Exists" || echo "✗ Missing"
test -f packages/revealui/src/core/__tests__/fieldTraversal.test.ts && echo "✓ Exists" || echo "✗ Missing"
```

**Step 2: Count actual test cases**
```bash
# Count "it(" statements (actual tests)
grep -c "it(" packages/revealui/src/core/__tests__/checkDependencies.test.ts
grep -c "it(" packages/revealui/src/core/__tests__/findGlobal.test.ts
grep -c "it(" packages/revealui/src/core/__tests__/fieldTraversal.test.ts
```

**Step 3: Run tests and verify count**
```bash
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core 2>&1 | grep "Tests"
# Should match sum of individual test counts
```

---

### 4. Verify Against Implementation Plan

**Step 1: Check what Phase 1 includes**
```bash
grep -A 20 "Phase 1:" IMPLEMENTATION-PLAN.md
```

**Step 2: Cross-reference with actual work**
```bash
# Check if all Phase 1 tasks have implementations
grep -E "Task 1\.1|Task 1\.2" IMPLEMENTATION-PLAN.md
# Then verify each has:
# - Implementation code
# - Tests
# - No TODO comments
```

---

### 5. Verify "No Errors" Claims

**Build Check:**
```bash
pnpm build --filter @revealui/core 2>&1 | grep -E "error|Error|failed|Failed" | head -20
# Should be empty or only show warnings
```

**Type Check:**
```bash
pnpm typecheck --filter @revealui/core 2>&1 | grep -E "error TS" | head -20
# Should be empty
```

**Lint Check:**
```bash
pnpm lint --filter @revealui/core 2>&1 | grep -E "error|Error" | head -20
# Should be empty or only show warnings
```

---

## Automated Verification Script

Create a verification script:

```bash
#!/bin/bash
# verify-phase1.sh

echo "=== Phase 1 Verification ==="
echo ""

# 1. Check test files exist
echo "1. Checking test files..."
MISSING=0
for file in checkDependencies.test.ts findGlobal.test.ts fieldTraversal.test.ts; do
  if [ -f "packages/revealui/src/core/__tests__/$file" ]; then
    echo "  ✓ $file exists"
  else
    echo "  ✗ $file MISSING"
    MISSING=1
  fi
done

if [ $MISSING -eq 1 ]; then
  echo "FAIL: Missing test files"
  exit 1
fi

# 2. Run tests
echo ""
echo "2. Running tests..."
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core > /tmp/test-output.txt 2>&1
TEST_EXIT=$?

if [ $TEST_EXIT -eq 0 ]; then
  echo "  ✓ Tests passed"
  TEST_COUNT=$(grep -oP "Tests\s+\K\d+" /tmp/test-output.txt | head -1)
  echo "  → Test count: $TEST_COUNT"
else
  echo "  ✗ Tests FAILED"
  cat /tmp/test-output.txt | tail -20
  exit 1
fi

# 3. Check implementations exist
echo ""
echo "3. Checking implementations..."
if grep -q "export function checkDependencies" packages/revealui/src/core/revealui.ts; then
  echo "  ✓ checkDependencies implemented"
else
  echo "  ✗ checkDependencies NOT FOUND"
  exit 1
fi

if grep -q "async findGlobal" packages/revealui/src/core/revealui.ts; then
  echo "  ✓ findGlobal implemented"
else
  echo "  ✗ findGlobal NOT FOUND"
  exit 1
fi

# 4. Check for stubs/TODOs
echo ""
echo "4. Checking for stubs/TODOs..."
if grep -A 5 "async findGlobal" packages/revealui/src/core/revealui.ts | grep -q "throw.*not implemented"; then
  echo "  ✗ findGlobal appears to be a stub"
  exit 1
else
  echo "  ✓ findGlobal is implemented (not a stub)"
fi

echo ""
echo "=== Verification Complete ==="
echo "✓ All checks passed"
```

---

## Red Flags to Watch For

### In Test Output
- ❌ Exit code non-zero
- ❌ "Tests failed" message
- ❌ Test count doesn't match claim
- ❌ Test files skipped that should run

### In Code
- ❌ Functions with only `throw new Error("not implemented")`
- ❌ TODO/FIXME comments in implementations
- ❌ Empty function bodies
- ❌ Missing type definitions

### In Reports
- ❌ Vague claims ("tests pass" without count)
- ❌ Claims without verification commands
- ❌ "Should work" instead of "verified working"
- ❌ No specific file paths or test names

---

## Trust Levels

### High Trust (Verified Independently)
- ✅ Test output shows specific counts
- ✅ Build succeeds with exit code 0
- ✅ Files exist and can be examined
- ✅ Code reviewed manually

### Medium Trust (Probable)
- ✅ Agent provides specific commands to run
- ✅ Agent shows file contents
- ✅ Agent acknowledges limitations

### Low Trust (Verify Before Believing)
- ❌ Vague status reports
- ❌ Claims without evidence
- ❌ "Should work" statements
- ❌ No verification commands provided

---

## Recommended Workflow

### Before Trusting Any Claim:

1. **Ask for verification command**
   - "What command can I run to verify this?"
   - "Show me the test output"
   - "What file should I check?"

2. **Run the verification yourself**
   - Don't trust, verify
   - Run commands in your own terminal
   - Check exit codes

3. **Review code directly**
   - Look at actual files
   - Check for TODOs/stubs
   - Verify test coverage

4. **Cross-reference with plan**
   - Compare against requirements
   - Check against implementation plan
   - Verify all items addressed

---

## Example: Verifying "Phase 1 Tests Complete" Claim

**Step 1: Get specific claim**
- Agent says: "41 tests passing for Phase 1"

**Step 2: Verify test files exist**
```bash
ls packages/revealui/src/core/__tests__/checkDependencies.test.ts
ls packages/revealui/src/core/__tests__/findGlobal.test.ts
ls packages/revealui/src/core/__tests__/fieldTraversal.test.ts
```

**Step 3: Run tests yourself**
```bash
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core
```

**Step 4: Verify count matches**
```bash
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core 2>&1 | grep "Tests"
# Should show "Tests  41 passed"
```

**Step 5: Check exit code**
```bash
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core
echo $?  # Should be 0
```

**Step 6: Count manually (optional)**
```bash
grep -c "it(" packages/revealui/src/core/__tests__/checkDependencies.test.ts
grep -c "it(" packages/revealui/src/core/__tests__/findGlobal.test.ts
grep -c "it(" packages/revealui/src/core/__tests__/fieldTraversal.test.ts
# Sum should be ~41
```

---

## Key Principle

**Don't trust, verify.**

Every claim should be verifiable with:
- ✅ Specific command to run
- ✅ Expected output
- ✅ File paths to check
- ✅ Exit codes to verify

If the agent can't provide these, the claim is unverified.

## Related Documentation

- [Testing Strategy](../development/testing/TESTING-STRATEGY.md) - Testing guidelines
- [Status Dashboard](../STATUS.md) - Current project state
- [Implementation Summary](../development/implementation/IMPLEMENTATION-SUMMARY.md) - Implementation overview
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task
