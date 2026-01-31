# Prompt for Next Agent: Fix Production Blockers

You are taking over work on the RevealUI Framework's hybrid approach for ElectricSQL integration. The previous agent implemented the architecture but left **critical production blockers** that must be fixed.

## Context

The hybrid approach uses:
- **ElectricSQL shapes** for reads (verified ✅)
- **RevealUI CMS API** for mutations (partially implemented ⚠️)

**Status**: Code compiles, tests pass (but are mocked), but **cannot deploy to production** due to critical issues.

## Your Mission

Fix the **P0 production blockers** identified in the brutal assessment so this can be safely deployed.

## Critical Issues to Fix (Priority Order)

### 1. AgentId/UserId Mapping (P0 - 2-4 hours)

**Problem**: Code assumes `agentId === userId` but this was never verified. If wrong, data corruption or 404s.

**Location**: `packages/sync/src/hooks/useAgentMemory.ts` (lines 166-168, 194-195, 213-214)

**What to do**:
1. Find the data model - what's the relationship between `agentId` and `userId`?
   - Check schema files, database migrations, or existing API calls
   - Look for how other parts of the codebase handle this
2. If they're the same: Add validation/comments confirming this
3. If they're different: Create a mapping/adapter function
4. Update tests to verify the mapping works

**Files to check**:
- `packages/sync/src/schema.ts` - Type definitions
- Database schema files
- Other API routes that use userId or agentId
- `apps/cms/src/app/api/memory/context/[sessionId]/[agentId]/route.ts` - How does context API handle this?

### 2. Memory Update Endpoint Missing (P0 - 1-2 hours)

**Problem**: Code calls `PUT /api/memory/episodic/:userId/:memoryId` but this endpoint doesn't exist.

**Location**: 
- Calls it: `packages/sync/src/utils/revealui-api.ts` (lines 136-143)
- Missing: `apps/cms/src/app/api/memory/episodic/[userId]/[memoryId]/route.ts`

**What to do**:
1. Open the route file - you'll see only `DELETE` is exported
2. Create a `PUT` or `PATCH` handler (look at POST handler in parent route for pattern)
3. Use `EpisodicMemory` class to update memory (similar to POST/DELETE)
4. Test manually with curl:
   ```bash
   curl -X PUT http://localhost:4000/api/memory/episodic/test-user/test-memory \
     -H "Content-Type: application/json" \
     -d '{"metadata": {"importance": 0.9}}'
   ```
5. Update tests to verify endpoint exists (not just mock)

**Reference**: 
- `apps/cms/src/app/api/memory/episodic/[userId]/route.ts` - See POST pattern
- `apps/cms/src/app/api/memory/episodic/[userId]/[memoryId]/route.ts` - See DELETE pattern

### 3. Real Integration Tests (P0 - 4-8 hours)

**Problem**: All tests mock API calls - they don't verify endpoints actually work.

**Location**: `packages/sync/src/__tests__/integration/`

**What to do**:
1. Create a test database setup (or use existing test setup)
2. Start CMS server for tests
3. Create real integration tests that:
   - Call actual endpoints (not mocked)
   - Use real data models
   - Verify agentId/userId mapping works
   - Test error scenarios with real API
4. Keep mocked tests as "unit tests", add real tests as "integration tests"

## Optional but Recommended (P1)

### 4. Verify Conversation Endpoints (1 hour)

**What to do**:
1. Start CMS: `pnpm --filter cms dev`
2. Test endpoints:
   ```bash
   curl http://localhost:4000/api/conversations
   curl -X POST http://localhost:4000/api/conversations -d '{"session_id":"test",...}'
   curl -X PATCH http://localhost:4000/api/conversations/:id -d '{"status":"completed"}'
   curl -X DELETE http://localhost:4000/api/conversations/:id
   ```
3. Document results

### 5. Improve Error Handling (2-4 hours)

Add retry logic, timeouts, better error messages.

## Quick Start

```bash
# 1. Understand the codebase
cd packages/sync
read BRUTAL_AGENT_ASSESSMENT.md  # Start here!
read AGENT_HANDOFF_HYBRID_APPROACH.md

# 2. Check current state
pnpm test  # All tests pass (but mocked)
pnpm typecheck  # Compiles cleanly

# 3. Start investigating issues
# Check data model for agentId vs userId
# Check route file for missing PUT endpoint

# 4. Make fixes
# Fix agentId/userId mapping
# Create PUT endpoint
# Add real integration tests
```

## Files to Focus On

### Must Read
- `BRUTAL_AGENT_ASSESSMENT.md` - Complete context on all issues
- `AGENT_HANDOFF_HYBRID_APPROACH.md` - This handoff document
- `packages/sync/src/hooks/useAgentMemory.ts` - Has agentId/userId issue
- `apps/cms/src/app/api/memory/episodic/[userId]/[memoryId]/route.ts` - Missing PUT

### Reference
- `apps/cms/src/app/api/memory/episodic/[userId]/route.ts` - POST pattern
- `packages/sync/src/utils/revealui-api.ts` - API utilities
- `packages/sync/src/schema.ts` - Type definitions

## Success Criteria

Before marking as production-ready:

- [ ] AgentId/userId relationship verified and properly handled
- [ ] Memory PUT endpoint created and tested manually
- [ ] All endpoints verified to exist and work
- [ ] Real integration tests added (not just mocks)
- [ ] Tests pass with real API
- [ ] Documentation updated with verified facts

## What NOT to Do

- ❌ Don't assume agentId === userId without verifying
- ❌ Don't skip manual endpoint testing
- ❌ Don't trust mocked tests for production readiness
- ❌ Don't deploy without fixing P0 issues

## Questions to Answer

Before you finish, document:

1. What is the relationship between agentId and userId?
2. Does the PUT endpoint now exist and work?
3. Have you tested endpoints manually?
4. Do real integration tests pass?
5. Is this production-ready? (Be honest!)

## Helpful Commands

```bash
# Test sync package
pnpm --filter @revealui/sync test
pnpm --filter @revealui/sync typecheck
pnpm --filter @revealui/sync build

# Start CMS for manual testing
pnpm --filter cms dev

# Test endpoints
curl http://localhost:4000/api/memory/episodic/:userId
curl -X PUT http://localhost:4000/api/memory/episodic/:userId/:memoryId -d '{}'
curl http://localhost:4000/api/conversations
```

## Architecture Context

```
Hybrid Approach:
├── Reads: ElectricSQL Shapes (/v1/shape) ✅ VERIFIED
└── Mutations: RevealUI CMS API ⚠️ NEEDS FIXES
    ├── /api/memory/context/:sessionId/:agentId ✅ Works
    ├── /api/memory/episodic/:userId ⚠️ agentId/userId issue
    │   └── PUT /api/memory/episodic/:userId/:memoryId ❌ MISSING
    └── /api/conversations ⚠️ Unverified
```

## Final Notes

- **Foundation is solid** - Architecture is good, code is clean
- **Issues are fixable** - Not architectural problems, just missing verification
- **Be thorough** - Verify everything, don't assume
- **Test manually** - Don't trust that mocks match reality
- **Update docs** - Be honest about what's verified vs. assumed

Good luck! Fix the blockers, verify everything works, and then we can deploy. 🚀
