# Production Readiness - Action Plan

**Created:** 2026-02-06
**Priority:** HIGH
**Est. Time:** 3-4 hours
**Goal:** Address critical gaps before production deployment

---

## 🔴 Critical Actions (Do Before Production)

### Action 1: Create Environment Variables Template
**Priority:** HIGH
**Time:** 15 minutes
**Status:** ⏳ Pending

**Task:**
Create `.env.production.template` with all required variables

```bash
# File: apps/cms/.env.production.template

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Application
NEXT_PUBLIC_SERVER_URL=https://yourdomain.com
NODE_ENV=production

# Authentication
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://yourdomain.com

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sentry (optional but recommended)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=your-auth-token

# Vercel Blob Storage (if using)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# OpenAI (if using AI features)
OPENAI_API_KEY=sk-...

# Electric SQL (if using real-time sync)
ELECTRIC_URL=https://...
```

**Verification:**
```bash
# Check all required vars are documented
cat apps/cms/.env.production.template
```

---

### Action 2: Add Rate Limiting to API Routes
**Priority:** HIGH
**Time:** 45-60 minutes
**Status:** ⏳ Pending

**Task:**
Implement rate limiting on authentication and sensitive endpoints

**Files to Create:**
1. `apps/cms/src/middleware/rateLimit.ts`
2. Update API routes to use rate limiting

**Implementation:**

```typescript
// apps/cms/src/middleware/rateLimit.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS = 10 // per window

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export function rateLimit(identifier: string): boolean {
  const now = Date.now()
  const record = store[identifier]

  if (!record || now > record.resetTime) {
    // Create new window
    store[identifier] = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    }
    return true
  }

  if (record.count >= MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

export function getRateLimitHeaders(identifier: string) {
  const record = store[identifier]
  if (!record) {
    return {
      'X-RateLimit-Limit': MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': MAX_REQUESTS.toString(),
      'X-RateLimit-Reset': (Date.now() + RATE_LIMIT_WINDOW).toString(),
    }
  }

  return {
    'X-RateLimit-Limit': MAX_REQUESTS.toString(),
    'X-RateLimit-Remaining': Math.max(0, MAX_REQUESTS - record.count).toString(),
    'X-RateLimit-Reset': record.resetTime.toString(),
  }
}
```

**Apply to sensitive routes:**
- `/api/auth/sign-in`
- `/api/auth/sign-up`
- `/api/auth/password-reset`
- `/api/gdpr/*`

**Example Usage:**
```typescript
// apps/cms/src/app/api/auth/sign-in/route.ts
import { rateLimit, getRateLimitHeaders } from '@/middleware/rateLimit'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'

  if (!rateLimit(ip)) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: getRateLimitHeaders(ip),
    })
  }

  // ... rest of sign-in logic
}
```

**Testing:**
```bash
# Test rate limit
for i in {1..15}; do
  curl -X POST http://localhost:4000/api/auth/sign-in \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}'
  echo ""
done
```

---

### Action 3: Test Database Migrations
**Priority:** HIGH
**Time:** 30 minutes
**Status:** ⏳ Pending

**Task:**
Verify migrations work in production-like environment

**Steps:**
1. Create test database
2. Run all migrations
3. Verify schema
4. Test rollback (if supported)
5. Document migration procedure

**Commands:**
```bash
# 1. Create fresh test database
createdb revealui_test

# 2. Set test DATABASE_URL
export DATABASE_URL="postgresql://localhost/revealui_test"

# 3. Run migrations
pnpm db:migrate

# 4. Verify with Drizzle Studio
pnpm db:studio

# 5. Check schema
psql revealui_test -c "\dt"

# 6. Clean up
dropdb revealui_test
```

**Document in runbook:**
- Migration steps
- Rollback procedure
- Backup before migration
- Verification steps

---

### Action 4: Set Up CI/CD Checks
**Priority:** MEDIUM-HIGH
**Time:** 45 minutes
**Status:** ⏳ Pending

**Task:**
Add automated checks to CI/CD pipeline

**File:** `.github/workflows/ci.yml` (or your CI config)

**Add these checks:**

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      # Install dependencies
      - run: pnpm install

      # Type check
      - run: pnpm typecheck

      # Lint
      - run: pnpm lint

      # Tests
      - run: pnpm test

      # Build
      - run: pnpm build

      # Bundle size check
      - run: pnpm size
        continue-on-error: true  # Don't fail build, just warn

      # Security audit
      - run: pnpm audit --audit-level=high
        continue-on-error: true
```

**Additional checks to consider:**
- Lighthouse CI (performance)
- OWASP dependency check
- License compliance
- Coverage thresholds

---

## 🟡 Important Actions (Do Soon After Launch)

### Action 5: Create Production Runbook
**Priority:** MEDIUM
**Time:** 2 hours
**Status:** ⏳ Pending

**Task:**
Document operational procedures

**Topics to cover:**
1. **Deployment Procedure**
   - Build steps
   - Database migration
   - Environment variable check
   - Smoke tests
   - Rollback procedure

2. **Common Issues & Solutions**
   - Database connection errors
   - Build failures
   - Memory issues
   - Performance degradation

3. **Emergency Procedures**
   - Incident response
   - Rollback steps
   - Emergency contacts
   - Communication plan

4. **Monitoring & Alerts**
   - What to monitor
   - Alert thresholds
   - On-call procedures
   - Escalation paths

**Create:** `docs/RUNBOOK.md`

---

### Action 6: Configure Monitoring Alerts
**Priority:** MEDIUM
**Time:** 30 minutes
**Status:** ⏳ Pending

**Task:**
Set up proactive alerts in Sentry and monitoring tools

**Sentry Alerts:**
- Error rate > 10 errors/minute
- New error types
- Performance degradation (P95 > 2s)
- Release issues

**Uptime Monitoring:**
- Set up with service like UptimeRobot, Pingdom, or Datadog
- Monitor: `/api/health` endpoint
- Check interval: 5 minutes
- Alert on: 3 consecutive failures

**Configuration:**
```yaml
# Example uptime-robot config
monitors:
  - name: "CMS Health Check"
    url: "https://yourdomain.com/api/health"
    interval: 300  # 5 minutes
    alert_contacts:
      - email: "ops@yourdomain.com"
      - slack: "#alerts"
```

---

### Action 7: Load Testing
**Priority:** MEDIUM
**Time:** 2-3 hours
**Status:** ⏳ Pending (post-launch)

**Task:**
Test application under expected production load

**Tools:**
- k6 (recommended)
- Artillery
- Apache JMeter

**Test Scenarios:**
1. **Baseline Load**
   - 10 concurrent users
   - Duration: 5 minutes
   - Target: All requests succeed, P95 < 500ms

2. **Peak Load**
   - 100 concurrent users
   - Duration: 10 minutes
   - Target: < 1% error rate, P95 < 1s

3. **Stress Test**
   - Gradually increase to 500 users
   - Find breaking point
   - Identify bottlenecks

**Example k6 script:**
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 100 }, // Spike to 100
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1s
    http_req_failed: ['rate<0.01'],     // < 1% errors
  },
};

export default function () {
  // Test health endpoint
  const health = http.get('https://yourdomain.com/api/health');
  check(health, { 'health check OK': (r) => r.status === 200 });

  // Test homepage
  const home = http.get('https://yourdomain.com/');
  check(home, { 'homepage OK': (r) => r.status === 200 });

  sleep(1);
}
```

**Run:**
```bash
k6 run load-test.js
```

---

## 🔵 Optional Actions (Nice to Have)

### Action 8: Accessibility Audit
**Priority:** LOW
**Time:** 3-4 hours
**Status:** ⏳ Pending

**Tools:**
- axe DevTools
- WAVE
- Lighthouse accessibility score
- Manual keyboard testing
- Screen reader testing

**Target:** WCAG 2.1 AA compliance

---

### Action 9: Performance Budget
**Priority:** LOW
**Time:** 1 hour
**Status:** ⏳ Pending

**Task:**
Set and enforce performance budgets

**Example budget:**
```json
{
  "timings": {
    "FCP": 1800,  // First Contentful Paint
    "LCP": 2500,  // Largest Contentful Paint
    "TTI": 3800,  // Time to Interactive
    "CLS": 0.1    // Cumulative Layout Shift
  },
  "resourceSizes": [
    {
      "resourceType": "script",
      "budget": 300000  // 300 KB
    },
    {
      "resourceType": "stylesheet",
      "budget": 50000   // 50 KB
    },
    {
      "resourceType": "image",
      "budget": 500000  // 500 KB
    }
  ]
}
```

---

## Summary & Timeline

### Must Do Before Launch (3-4 hours)
1. ✅ **Fix 'services' reference** - DONE (5 min)
2. ⏳ **Environment variables template** (15 min)
3. ⏳ **Rate limiting** (60 min)
4. ⏳ **Test migrations** (30 min)
5. ⏳ **CI/CD setup** (45 min)

### Do Within 1 Week of Launch (5-6 hours)
6. ⏳ **Production runbook** (2 hours)
7. ⏳ **Monitoring alerts** (30 min)
8. ⏳ **Load testing** (3 hours)

### Do Within 1 Month (4-5 hours)
9. ⏳ **Accessibility audit** (4 hours)
10. ⏳ **Performance budget** (1 hour)

---

## Next Steps

**Immediate:**
```bash
# 1. Create env template
touch apps/cms/.env.production.template
# Add all required variables (see Action 1)

# 2. Implement rate limiting
mkdir -p apps/cms/src/middleware
# Create rateLimit.ts (see Action 2)

# 3. Test migrations
# Follow steps in Action 3

# 4. Update CI/CD
# Add checks to GitHub Actions (see Action 4)
```

**Track Progress:**
Use this document as a checklist, marking items as complete with dates.

---

**Status:** 1/10 actions complete
**ETA for production:** 3-4 hours of focused work
**Last Updated:** 2026-02-06
