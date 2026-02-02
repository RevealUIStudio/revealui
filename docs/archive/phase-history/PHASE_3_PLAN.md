# Phase 3: Error Handling & Monitoring - Implementation Plan

**Date**: 2026-02-01
**Status**: 🟡 **IN PROGRESS** - Planning complete, implementation starting
**Current Maturity**: 6/10 - Strong foundation, needs external integration

---

## Executive Summary

Phase 3 will enhance error handling and monitoring by:
1. Completing Sentry integration for production error tracking
2. Adding React error boundaries to prevent app crashes
3. Creating a monitoring dashboard UI
4. Improving error tracking and alerting

### Current State Assessment

**Strengths** ✅:
- Custom error classes with metadata
- Structured logging infrastructure
- Comprehensive health monitoring (process, memory, CPU)
- Zombie process detection and cleanup
- Multiple health check endpoints
- Alert system with configurable thresholds

**Gaps** ❌:
- Sentry configured but not activated
- No error boundaries in main CMS app
- Limited external observability integration
- No monitoring dashboard UI
- No distributed tracing

---

## Priority Ranking

### 🔴 Critical (Must Have - This Sprint)

**1. Complete Sentry Integration** (~2 hours)
- **Impact**: Production error tracking, stack traces, release tracking
- **Effort**: Low (config exists, just needs activation)
- **Files**:
  - Create `apps/cms/sentry.client.config.ts`
  - Create `apps/cms/sentry.server.config.ts`
  - Update `next.config.mjs` with Sentry webpack plugin
- **Success Criteria**: Errors captured in Sentry dashboard

**2. Add Error Boundaries to CMS App** (~1 hour)
- **Impact**: Prevents complete app crashes from React errors
- **Effort**: Low (copy pattern from docs app)
- **Files**:
  - Create `apps/cms/src/components/ErrorBoundary.tsx`
  - Update `apps/cms/src/app/layout.tsx`
- **Success Criteria**: React errors show fallback UI, not blank screen

**3. Create Monitoring Dashboard** (~3 hours)
- **Impact**: Visibility into system health and alerts
- **Effort**: Medium (UI components + API integration)
- **Files**:
  - `apps/dashboard/src/components/SystemHealthPanel.tsx` (exists in tests)
  - Health metrics API route
  - Real-time updates via polling/SSE
- **Success Criteria**: Dashboard shows live health metrics

### 🟡 Important (Should Have - Next Sprint)

**4. Database Error Tracking** (~2 hours)
- **Impact**: Better database error categorization
- **Effort**: Medium (parse error codes, not just messages)
- **Files**:
  - `packages/core/src/utils/errors.ts`
  - Detect constraint violations, timeouts, deadlocks
- **Success Criteria**: Database errors properly categorized

**5. Request Context Middleware** (~2 hours)
- **Impact**: Request tracing across services
- **Effort**: Medium (middleware + context propagation)
- **Files**:
  - `apps/cms/src/middleware.ts`
  - Add request ID header
  - Pass to logger
- **Success Criteria**: All logs include request ID

**6. Alert Integration** (~1 hour)
- **Impact**: Proactive issue notification
- **Effort**: Low (connect existing alerts to Sentry)
- **Files**:
  - `packages/core/src/monitoring/alerts.ts`
  - Send to Sentry events API
- **Success Criteria**: Critical alerts trigger Sentry notifications

### 🟢 Nice to Have (Could Have - Future)

**7. OpenTelemetry Tracing** (~4 hours)
- **Impact**: Distributed tracing across services
- **Effort**: High (instrument all services)
- **Success Criteria**: Traces visible in Jaeger/Zipkin

**8. Log Aggregation** (~3 hours)
- **Impact**: Centralized log storage and search
- **Effort**: Medium (integrate with ELK/Datadog)
- **Success Criteria**: Logs searchable in external service

**9. Performance Monitoring** (~2 hours)
- **Impact**: Track response times, slow queries
- **Effort**: Medium (custom metrics)
- **Success Criteria**: P95/P99 latency tracked

---

## Implementation Order

### Session 1: Sentry Integration (2 hours)

**Goal**: Capture production errors in Sentry

**Tasks**:
1. Create Sentry client config
2. Create Sentry server config
3. Update Next.js config with Sentry plugin
4. Test error capture (throw test error)
5. Verify in Sentry dashboard

**Files to Create/Modify**:
- `apps/cms/sentry.client.config.ts` (new)
- `apps/cms/sentry.server.config.ts` (new)
- `apps/cms/next.config.mjs` (modify)
- `apps/cms/package.json` (add @sentry/nextjs if needed)

### Session 2: Error Boundaries (1 hour)

**Goal**: Prevent React errors from crashing the app

**Tasks**:
1. Create ErrorBoundary component for CMS
2. Add to root layout
3. Test with intentional error
4. Verify fallback UI shows

**Files to Create/Modify**:
- `apps/cms/src/components/ErrorBoundary.tsx` (new)
- `apps/cms/src/app/layout.tsx` (modify)

### Session 3: Monitoring Dashboard (3 hours)

**Goal**: Visual monitoring interface

**Tasks**:
1. Create SystemHealthPanel component
2. Fetch health metrics from API
3. Display metrics with visual indicators
4. Add real-time updates
5. Show alerts and zombie processes

**Files to Create/Modify**:
- `apps/dashboard/src/components/SystemHealthPanel.tsx` (implement from test)
- `apps/dashboard/src/app/api/health/route.ts` (new)
- `apps/dashboard/src/app/monitoring/page.tsx` (new)

### Session 4: Database Error Tracking (2 hours)

**Goal**: Better error categorization

**Tasks**:
1. Parse Postgres error codes
2. Detect constraint violations
3. Detect timeouts and deadlocks
4. Enhance error messages
5. Add tests

**Files to Modify**:
- `packages/core/src/utils/errors.ts`
- `packages/db/src/client/index.ts`

---

## Success Metrics

### Before Phase 3
- Error visibility: Console logs only
- Error capture rate: 0% (no tracking)
- React error handling: App crashes
- Monitoring visibility: API endpoints only
- MTTR (Mean Time To Recovery): Unknown (no alerts)

### After Phase 3 (Critical Items)
- Error visibility: Sentry dashboard with stack traces
- Error capture rate: >95% (Sentry integration)
- React error handling: Fallback UI prevents crashes
- Monitoring visibility: Real-time dashboard
- MTTR: <30 minutes (proactive alerts)

### After Phase 3 (All Items)
- Error visibility: Sentry + distributed traces
- Error capture rate: >98% (all sources tracked)
- React error handling: Graceful recovery + retry
- Monitoring visibility: Dashboard + external service
- MTTR: <15 minutes (automated alerts + context)

---

## Testing Strategy

### Sentry Integration Tests
```typescript
// Trigger test error
throw new Error('Test Sentry Integration')

// Verify in Sentry:
// - Error captured
// - Stack trace present
// - Environment tagged
// - Release version tracked
```

### Error Boundary Tests
```typescript
// Component that throws
const ErrorComponent = () => {
  throw new Error('Test Error Boundary')
}

// Render in app
// Verify:
// - Fallback UI shows
// - Error logged to Sentry
// - User can recover/retry
```

### Monitoring Dashboard Tests
```typescript
// Check dashboard displays:
// - System metrics (memory, CPU, uptime)
// - Database pool status
// - Active alerts
// - Zombie processes
// - Real-time updates
```

---

## Configuration

### Sentry Environment Variables

```env
# Required
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=revealui
SENTRY_PROJECT=cms

# Optional
SENTRY_AUTH_TOKEN=... # For uploads
SENTRY_SAMPLE_RATE=0.1 # 10% in production
```

### Alert Thresholds (Current)

```typescript
{
  zombies: { warning: 3, critical: 5 },
  memory: { warning: 512, critical: 1024 }, // MB
  activeProcesses: { warning: 50, critical: 100 },
  dbWaiting: { warning: 5, critical: 10 },
  spawnRate: { warning: 20, critical: 50 }, // per minute
}
```

---

## Rollback Plan

### If Sentry Causes Issues
1. Remove Sentry webpack plugin from `next.config.mjs`
2. Set `SENTRY_DSN=""` to disable
3. Errors still logged to console

### If Error Boundary Breaks
1. Remove `<ErrorBoundary>` wrapper from layout
2. App reverts to default React error handling

### If Dashboard Has Performance Issues
1. Increase polling interval (1s → 5s)
2. Disable real-time updates
3. Remove from main app (keep as separate route)

---

## Dependencies

### Required Packages (if not installed)
```json
{
  "@sentry/nextjs": "^8.x",
  "@sentry/react": "^8.x",
  "@sentry/node": "^8.x"
}
```

### Optional Packages
```json
{
  "@opentelemetry/api": "^1.x", // For tracing
  "pino": "^8.x", // For structured logging
  "pino-pretty": "^10.x" // For dev logging
}
```

---

## Documentation Updates

After Phase 3, update:
1. **README.md** - Add monitoring section
2. **docs/development/ERROR_HANDLING.md** - Error handling guide
3. **docs/development/MONITORING.md** - Monitoring guide
4. **docs/deployment/OBSERVABILITY.md** - Production monitoring

---

## Files Modified (Estimated)

### New Files (~8)
- `apps/cms/sentry.client.config.ts`
- `apps/cms/sentry.server.config.ts`
- `apps/cms/src/components/ErrorBoundary.tsx`
- `apps/dashboard/src/components/SystemHealthPanel.tsx`
- `apps/dashboard/src/app/monitoring/page.tsx`
- `apps/dashboard/src/app/api/health/route.ts`
- `docs/development/ERROR_HANDLING.md`
- `docs/development/MONITORING.md`

### Modified Files (~5)
- `apps/cms/next.config.mjs`
- `apps/cms/src/app/layout.tsx`
- `packages/core/src/utils/errors.ts`
- `packages/core/src/monitoring/alerts.ts`
- `README.md`

---

## Risk Assessment

### Low Risk ✅
- Sentry integration (well-documented, widely used)
- Error boundaries (React best practice)

### Medium Risk ⚠️
- Monitoring dashboard (could impact performance if poorly implemented)
- Database error parsing (might miss edge cases)

### High Risk ⛔
- None identified for critical items

---

## Next Steps

**Immediate**:
1. Start with Sentry integration (highest ROI, lowest risk)
2. Add error boundaries (prevents crashes)
3. Create monitoring dashboard (visibility)

**This Sprint**:
- Complete critical items (1-3)
- Document error handling patterns
- Test in staging environment

**Next Sprint**:
- Implement important items (4-6)
- Add OpenTelemetry if needed
- Integrate with log aggregation service

---

**Status**: Phase 3 **PLANNING COMPLETE** ✅
**Next**: Implement Sentry integration
**Estimated Time**: 6 hours for critical items
**Grade Target**: 6/10 → 8/10 (error tracking + monitoring)
