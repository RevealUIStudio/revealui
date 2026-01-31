# Testing Guide for RevealUI Framework

## Overview

This comprehensive testing guide covers all aspects of testing for the RevealUI Framework, including unit and integration testing, load testing, penetration testing, and verification procedures. The goal is to ensure the system is secure, performant, and reliable before production deployment.

---

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Testing Infrastructure](#testing-infrastructure)
3. [Test Coverage Requirements](#test-coverage-requirements)
4. [Unit and Integration Testing](#unit-and-integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Load Testing](#load-testing)
7. [Penetration Testing](#penetration-testing)
8. [Verification Procedures](#verification-procedures)
9. [Tools and Frameworks](#tools-and-frameworks)
10. [Best Practices](#best-practices)

---

## Testing Strategy

### Testing Infrastructure

**Tools & Frameworks:**
- **Unit/Integration Testing**: Vitest
- **E2E Testing**: Playwright
- **Coverage Reporting**: @vitest/coverage-v8
- **Testing Library**: @testing-library/react
- **Load Testing**: k6, Artillery
- **Security Testing**: OWASP ZAP, Nuclei, Burp Suite

**Test Locations:**
```
apps/cms/src/__tests__/          # CMS unit/integration tests
apps/web/src/__tests__/           # Web app unit/integration tests
packages/test/src/                # Shared test utilities and E2E tests
packages/test/load-tests/         # Load testing scripts
```

---

## Test Coverage Requirements

### Priority 1: Critical Security Paths

1. **Authentication & Authorization**
   - [x] Health check endpoint
   - [ ] User login flow
   - [ ] User logout and JWT invalidation
   - [ ] Session management
   - [ ] Password validation
   - [ ] Multi-tenant isolation

2. **Access Control**
   - [ ] Role-based access control (RBAC)
   - [ ] User-level permissions
   - [ ] Tenant-level permissions
   - [ ] Collection-level access rules

3. **Payment Processing**
   - [ ] Stripe webhook signature verification
   - [ ] Payment intent creation
   - [ ] Checkout session handling
   - [ ] Subscription management

### Priority 2: Core Functionality

4. **Form Submissions**
   - [x] Form data validation (Zod schemas)
   - [ ] Form submission endpoint
   - [ ] Error handling

5. **API Endpoints**
   - [x] Health check endpoint
   - [ ] Custom API routes
   - [ ] CORS handling
   - [ ] Rate limiting (when implemented)

6. **Data Validation**
   - [x] Email validation
   - [x] Password strength validation
   - [x] URL validation
   - [x] Slug validation

### Priority 3: Performance & Reliability

7. **Load Testing**
   - [ ] Authentication endpoints under load
   - [ ] API endpoint response times
   - [ ] Database query performance
   - [ ] Concurrent user handling

8. **Security Testing**
   - [ ] Penetration testing
   - [ ] SQL injection prevention
   - [ ] XSS prevention
   - [ ] CSRF protection

---

## Unit and Integration Testing

### Test Structure

**Unit Tests Example:**
```typescript
// Example: apps/cms/src/__tests__/validation.test.ts
import { describe, it, expect } from "vitest"
import { emailSchema, passwordSchema } from "../lib/validation/schemas"

describe("Email Validation", () => {
  it("should accept valid email addresses", () => {
    const result = emailSchema.safeParse("user@example.com")
    expect(result.success).toBe(true)
  })

  it("should reject invalid email addresses", () => {
    const result = emailSchema.safeParse("invalid-email")
    expect(result.success).toBe(false)
  })
})
```

**Integration Tests Example:**
```typescript
// Example: Test authentication flow
describe("Authentication Integration", () => {
  it("should login and receive valid JWT", async () => {
    // Test implementation
  })

  it("should invalidate JWT on logout", async () => {
    // Test implementation
  })
})
```

### Test Data Management

**Test Database:**
- Use separate test database (configure via `DATABASE_URL_TEST`)
- Seed with minimal required data
- Reset between test runs

**Test Users:**
```typescript
// Test user credentials (for testing only)
const TEST_USERS = {
  superAdmin: {
    email: "test-superadmin@example.com",
    password: "Test1234!",
    roles: ["user-super-admin"],
  },
  admin: {
    email: "test-admin@example.com",
    password: "Test1234!",
    roles: ["user-admin"],
  },
  user: {
    email: "test-user@example.com",
    password: "Test1234!",
    roles: [],
  },
}
```

### Mocking Strategy

**External Services:**
- **Stripe**: Use Stripe test mode and webhook fixtures
- **Supabase**: Mock database calls in unit tests, use test DB for integration
- **External APIs**: Mock HTTP responses

**Example Mock:**
```typescript
import { vi } from "vitest"

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.succeeded",
        data: { object: {} },
      }),
    },
  })),
}))
```

### Coverage Goals

**Minimum Coverage Targets:**
- **Statements**: 70%
- **Branches**: 60%
- **Functions**: 70%
- **Lines**: 70%

**Critical Path Coverage:**
- Authentication/Authorization: **90%+**
- Payment Processing: **90%+**
- Access Control: **85%+**
- Data Validation: **95%+**

---

## End-to-End Testing

### E2E Test Example

```typescript
// Example: packages/test/src/e2e/auth.spec.ts
import { test, expect } from "@playwright/test"

test("user can login to admin panel", async ({ page }) => {
  await page.goto("http://localhost:4000/admin")
  await page.fill('input[name="email"]', "admin@example.com")
  await page.fill('input[name="password"]', "password")
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*admin/)
})
```

---

## Load Testing

### Load Testing Tools

**Recommended: k6**

**Installation:**
```bash
# Windows (via Chocolatey)
choco install k6

# macOS (via Homebrew)
brew install k6

# Or download from https://k6.io/
```

**Alternative: Artillery**
```bash
pnpm add -D artillery
```

### Test Scenarios

#### 1. Authentication Load Test

**Scenario**: Concurrent user logins

```javascript
// packages/test/load-tests/auth-login.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],    // Less than 1% failures
  },
};

export default function () {
  const payload = JSON.stringify({
    email: 'test-user@example.com',
    password: 'Test1234!',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    'http://localhost:4000/api/users/login',
    payload,
    params
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has JWT token': (r) => JSON.parse(r.body).token !== undefined,
  });

  sleep(1);
}
```

**Run:**
```bash
# From packages/test directory
k6 run load-tests/auth-login.js

# Or using pnpm script from project root
pnpm --filter test test:load:auth
```

#### 2. API Endpoint Load Test

**Scenario**: High traffic on public API endpoints

```javascript
// packages/test/load-tests/api-pages.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 200 },   // Spike to 200 users
    { duration: '2m', target: 200 },   // Stay at 200 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1s
    http_req_failed: ['rate<0.05'],    // Less than 5% failures
  },
};

export default function () {
  const res = http.get('http://localhost:4000/api/pages?limit=10');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has data': (r) => JSON.parse(r.body).docs !== undefined,
  });

  sleep(Math.random() * 2); // Random sleep 0-2s
}
```

#### 3. Payment Flow Load Test

**Scenario**: Concurrent checkout sessions

```javascript
// packages/test/load-tests/checkout.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 20 },    // Ramp up to 20 concurrent checkouts
    { duration: '3m', target: 20 },    // Maintain load
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% under 3s (payment APIs slower)
    http_req_failed: ['rate<0.01'],    // Less than 1% failures
  },
};

export default function () {
  // Login first to get token
  const loginRes = http.post(
    'http://localhost:4000/api/users/login',
    JSON.stringify({
      email: 'test-user@example.com',
      password: 'Test1234!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = JSON.parse(loginRes.body).token;

  // Create checkout session
  const checkoutRes = http.post(
    'http://localhost:4000/api/create-checkout-session',
    JSON.stringify({
      price: { id: 'price_test_123' },
      quantity: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  check(checkoutRes, {
    'status is 200': (r) => r.status === 200,
    'has session ID': (r) => JSON.parse(r.body).sessionId !== undefined,
  });

  sleep(3);
}
```

#### 4. Database Query Load Test

**Scenario**: Heavy read operations

```javascript
// packages/test/load-tests/database-queries.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,                    // 50 virtual users
  duration: '5m',             // Run for 5 minutes
  thresholds: {
    http_req_duration: ['p(95)<500'],   // Database queries should be fast
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Test various queries
  const queries = [
    '/api/pages?limit=10&sort=-createdAt',
    '/api/posts?where[status][equals]=published',
    '/api/products?limit=20',
    '/api/media?limit=10',
  ];

  const query = queries[Math.floor(Math.random() * queries.length)];
  const res = http.get(`http://localhost:4000${query}`);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

### Performance Targets

**Response Time Targets:**

| Endpoint Type | p50 | p95 | p99 |
|--------------|-----|-----|-----|
| Health Check | <100ms | <200ms | <500ms |
| Public APIs | <300ms | <1000ms | <2000ms |
| Auth Endpoints | <500ms | <1500ms | <3000ms |
| Payment APIs | <1000ms | <3000ms | <5000ms |

**Throughput Targets:**
- **Public APIs**: 100+ req/sec
- **Auth Endpoints**: 10+ req/sec
- **Webhook Processing**: 50+ req/sec

**Resource Limits:**
- **CPU**: < 80% under normal load
- **Memory**: < 70% of available
- **Database Connections**: < 80% of pool size

### Running Load Tests

**Local Environment:**
```bash
# Start application
pnpm dev

# In another terminal, run load test
cd packages/test
k6 run load-tests/auth-login.js

# Or using pnpm script from project root
pnpm --filter test test:load:auth

# With output to InfluxDB (optional)
k6 run --out influxdb=http://localhost:8086/k6 load-tests/auth-login.js
```

**Staging Environment:**
```bash
# Update test URLs to staging (from packages/test directory)
cd packages/test
k6 run -e BASE_URL=https://staging.your-domain.com load-tests/auth-login.js

# Run all tests
for test in load-tests/*.js; do
  k6 run -e BASE_URL=https://staging.your-domain.com "$test"
done
```

**Cloud Load Testing:**

Use k6 Cloud for distributed load testing:
```bash
# Upload and run in cloud (from packages/test directory)
cd packages/test
k6 cloud load-tests/auth-login.js
```

### Analyzing Load Test Results

**Key Metrics:**

1. **Response Time Distribution**
   - Review p50, p95, p99 percentiles
   - Identify slow endpoints

2. **Error Rate**
   - Acceptable: < 1% error rate
   - Investigate any 5xx errors

3. **Throughput**
   - Requests per second
   - Data transferred

4. **Virtual User Performance**
   - How many concurrent users can system handle?
   - At what point does performance degrade?

**k6 Output Example:**
```
     ✓ status is 200
     ✓ has JWT token

     checks.........................: 100.00% ✓ 2000      ✗ 0
     data_received..................: 1.2 MB  20 kB/s
     data_sent......................: 500 kB  8.3 kB/s
     http_req_blocked...............: avg=1.2ms    min=0s       med=0s      max=15ms     p(90)=2ms     p(95)=3ms
     http_req_duration..............: avg=250ms    min=100ms    med=200ms   max=2s       p(90)=450ms   p(95)=850ms
     http_req_failed................: 0.00%   ✓ 0         ✗ 1000
     http_reqs......................: 1000    16.666667/s
     iteration_duration.............: avg=1.25s    min=1.1s     med=1.2s    max=3s       p(90)=1.45s   p(95)=1.85s
     iterations.....................: 1000    16.666667/s
     vus............................: 50      min=10      max=50
     vus_max........................: 50      min=50      max=50
```

### Stress Testing

**Purpose**: Find the breaking point of the system.

**Stress Test Configuration:**
```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Normal load
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },    // 2x normal load
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },    // 3x normal load
    { duration: '5m', target: 300 },
    { duration: '10m', target: 0 },     // Recovery
  ],
};
```

**What to Monitor:**

1. **System Resources**
   - CPU utilization
   - Memory usage
   - Database connections
   - Network bandwidth

2. **Application Metrics**
   - Response time degradation
   - Error rate increase
   - Queue depths
   - Database query times

3. **Recovery**
   - How quickly system recovers after load removed
   - Any lingering effects

### Soak Testing

**Purpose**: Verify system stability over extended periods.

**Configuration:**
```javascript
export const options = {
  vus: 50,                    // Constant 50 users
  duration: '4h',             // Run for 4 hours
};
```

**What to Look For:**
- Memory leaks (increasing memory over time)
- Connection pool exhaustion
- Gradual performance degradation
- Resource leak indicators

### Load Test Scenarios

**Scenario 1: Normal Business Day**
- **Users**: 100-500 concurrent
- **Duration**: 8 hours
- **Pattern**: Gradual ramp-up, steady load, evening drop-off

**Scenario 2: Marketing Campaign**
- **Users**: Spike from 100 to 1000 in 10 minutes
- **Duration**: 2 hours elevated load
- **Pattern**: Sudden spike, sustained high load, gradual decrease

**Scenario 3: Black Friday / Flash Sale**
- **Users**: Spike from 500 to 2000
- **Duration**: 4 hours
- **Pattern**: Extreme spike, very high load, checkout heavy

### Continuous Load Testing

**Integration with CI/CD:**

Add to `.github/workflows/performance.yml`:
```yaml
name: Performance Testing

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly, Sunday 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: packages/test/load-tests/auth-login.js
          cloud: true
          token: ${{ secrets.K6_CLOUD_TOKEN }}
```

### Action Items After Load Testing

1. **Review Results**
   - Analyze metrics
   - Identify bottlenecks
   - Compare against targets

2. **Optimize**
   - Fix slow queries
   - Add caching where needed
   - Optimize resource usage

3. **Document Findings**
   - Record max capacity
   - Note any issues discovered
   - Update infrastructure plans

4. **Retest**
   - Verify optimizations effective
   - Confirm system meets targets

---

## Penetration Testing

### Important: Testing Ethics & Legal

**ONLY perform penetration testing on:**
- Your own systems
- Systems you have explicit written permission to test
- Non-production environments

**DO NOT:**
- Test production without approval
- Perform DoS attacks
- Access data you're not authorized to view
- Share vulnerabilities publicly before they're fixed

### Testing Scope

**In-Scope Systems:**
- CMS Application (`apps/cms`)
- Web Application (`apps/web`)
- API Endpoints (`/api/*`)
- Authentication System
- Payment Processing
- Multi-Tenant Isolation

**Out-of-Scope:**
- Third-party services (Stripe, Supabase, Vercel)
- Infrastructure provided by cloud vendors
- Other tenants' data (respect isolation)

### Testing Categories

#### 1. Authentication & Session Management

**Tests to Perform:**

- [ ] **Brute Force Attack**
  - Attempt multiple login failures
  - Verify rate limiting kicks in
  - Check account lockout mechanism

- [ ] **Session Fixation**
  - Verify session ID changes after login
  - Verify fix for GHSA-26rv-h2hf-3fw4

- [ ] **JWT Token Security**
  - Attempt to modify JWT payload
  - Attempt to use expired token
  - Verify token invalidated after logout
  - Check for JWT secrets in error messages

- [ ] **Password Reset**
  - Test password reset token expiration
  - Verify reset tokens are single-use
  - Check for information disclosure

**Tools:**
- Burp Suite
- OWASP ZAP
- Postman/curl

**Example:**
```bash
# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"email":"wrong@example.com","password":"wrong"}'
done
# Should receive 429 Too Many Requests after 5 attempts
```

#### 2. Authorization & Access Control

**Tests to Perform:**

- [ ] **Privilege Escalation**
  - Regular user tries to access admin endpoints
  - Tenant admin tries to access super admin functions
  - Verify role checks enforced

- [ ] **Multi-Tenant Isolation**
  - User from Tenant A tries to access Tenant B's data
  - Modify URL parameters to access other tenant IDs
  - Check for tenant ID in JWT claims

- [ ] **IDOR (Insecure Direct Object Reference)**
  - Access resources by guessing IDs
  - Modify ID parameters in API calls
  - Verify proper authorization checks

**Example:**
```bash
# Try to access another user's data
curl http://localhost:4000/api/users/999 \
  -H "Authorization: JWT <regular-user-token>"
# Should return 403 Forbidden
```

#### 3. Input Validation & Injection Attacks

**Tests to Perform:**

- [ ] **SQL Injection**
  - Test query parameters with SQL payloads
  - Test form inputs with SQL injection attempts
  - Verify RevealUI CMS/Drizzle ORM prevents injection

- [ ] **XSS (Cross-Site Scripting)**
  - Input `<script>alert('XSS')</script>` in form fields
  - Test rich text editor for script injection
  - Verify CSP blocks inline scripts

- [ ] **Command Injection**
  - Test file upload functionality
  - Test any system command execution
  - Verify input sanitization

- [ ] **Path Traversal**
  - Test file access with `../../etc/passwd`
  - Test media upload paths
  - Verify filesystem restrictions

**Example Payloads:**
```javascript
// SQL Injection
"' OR '1'='1"
"1; DROP TABLE users--"

// XSS
"<script>alert('XSS')</script>"
"<img src=x onerror=alert('XSS')>"

// Path Traversal
"../../.env.development.local"
"../../../etc/passwd"
```

#### 4. API Security

**Tests to Perform:**

- [ ] **CSRF Protection**
  - Verify CSRF tokens on state-changing requests
  - Test cross-origin requests
  - Check SameSite cookie attributes

- [ ] **CORS Misconfiguration**
  - Test requests from unauthorized origins
  - Verify `Access-Control-Allow-Origin` not set to `*`
  - Check credentials handling

- [ ] **Mass Assignment**
  - Try to set unexpected fields in POST/PATCH
  - Attempt to modify protected fields
  - Verify field-level permissions

- [ ] **API Rate Limiting**
  - Verify rate limits on all endpoints
  - Test different attack patterns
  - Check rate limit bypass techniques

**Example:**
```bash
# Test CORS from unauthorized origin
curl http://localhost:4000/api/pages \
  -H "Origin: https://malicious-site.com" \
  -v
# Should not include Access-Control-Allow-Origin header
```

#### 5. Payment Security

**Tests to Perform:**

- [ ] **Webhook Signature Bypass**
  - Send webhook without signature
  - Send webhook with invalid signature
  - Attempt to replay old webhooks

- [ ] **Price Manipulation**
  - Modify price in checkout request
  - Verify prices fetched from Stripe, not client
  - Check for price validation

- [ ] **Payment Data Exposure**
  - Verify no card data stored locally
  - Check API responses don't leak payment info
  - Verify PCI compliance

**Example:**
```bash
# Test webhook without signature
curl -X POST http://localhost:4000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"payment_intent.succeeded","data":{}}'
# Should return 400 Bad Request
```

#### 6. File Upload Security

**Tests to Perform:**

- [ ] **Malicious File Upload**
  - Upload executable files (.exe, .sh)
  - Upload files with double extensions
  - Upload oversized files

- [ ] **File Type Validation**
  - Upload non-image file to image field
  - Verify MIME type checking
  - Test file content validation

- [ ] **Path Traversal via Filename**
  - Upload with filename `../../malicious.php`
  - Verify filename sanitization

### Security Testing Tools

**Automated Scanning:**

1. **OWASP ZAP**
   ```bash
   # Install ZAP
   # Run automated scan
   zap-cli quick-scan --self-contained \
     --start-options '-config api.disablekey=true' \
     http://localhost:4000
   ```

2. **Nuclei**
   ```bash
   # Install Nuclei
   nuclei -u http://localhost:4000 -t ~/nuclei-templates/
   ```

3. **npm audit**
   ```bash
   pnpm audit --audit-level=moderate
   ```

**Manual Testing Tools:**
- **Burp Suite**: Comprehensive web security testing
- **Postman**: API testing and automation
- **curl**: Command-line HTTP testing
- **Browser DevTools**: Network inspection, cookie analysis

### Vulnerability Reporting

**Internal Process:**

1. **Document Finding**
   - Vulnerability description
   - Steps to reproduce
   - Potential impact
   - Suggested remediation

2. **Severity Classification**
   - **Critical**: Authentication bypass, data exposure
   - **High**: Privilege escalation, injection attacks
   - **Medium**: Information disclosure, DoS
   - **Low**: Minor security improvements

3. **Report to Team**
   - Use private channel
   - Include reproduction steps
   - Provide fix recommendations

**Report Template:**
```markdown
## Vulnerability Report

**Title**: [Brief description]
**Severity**: Critical/High/Medium/Low
**Date Found**: YYYY-MM-DD
**Tester**: [Your name]

### Description
[What is the vulnerability?]

### Impact
[What could an attacker do?]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Expected malicious outcome]

### Affected Components
- [File paths]
- [Endpoints]

### Suggested Fix
[How to remediate]

### References
- [CVE numbers if applicable]
- [Related documentation]
```

### Security Test Checklist

**Authentication Security:**
- [ ] Brute force protection active
- [ ] Session fixation prevented
- [ ] JWT properly validated and invalidated
- [ ] Password strength enforced
- [ ] Account enumeration prevented

**Authorization Security:**
- [ ] Role-based access control working
- [ ] Tenant isolation enforced
- [ ] Privilege escalation prevented
- [ ] IDOR vulnerabilities patched

**Input Validation:**
- [ ] SQL injection prevented
- [ ] XSS attacks blocked
- [ ] Command injection prevented
- [ ] Path traversal blocked
- [ ] File upload restrictions enforced

**API Security:**
- [ ] CORS properly configured
- [ ] CSRF protection enabled
- [ ] Rate limiting active
- [ ] Mass assignment prevented
- [ ] API authentication required

**Data Protection:**
- [ ] Sensitive data encrypted in transit (HTTPS)
- [ ] Sensitive data encrypted at rest
- [ ] No secrets in code or logs
- [ ] Environment variables secured
- [ ] Database access restricted

**Payment Security:**
- [ ] Webhook signatures verified
- [ ] No card data stored
- [ ] Price validation server-side
- [ ] PCI compliance maintained

### Remediation Timeline

**Critical Vulnerabilities:**
- **Fix**: Within 24 hours
- **Deploy**: Emergency patch
- **Communicate**: Immediate team notification

**High Vulnerabilities:**
- **Fix**: Within 1 week
- **Deploy**: Next scheduled release
- **Communicate**: Daily standup

**Medium Vulnerabilities:**
- **Fix**: Within 2 weeks
- **Deploy**: Regular sprint cycle

**Low Vulnerabilities:**
- **Fix**: Backlog priority
- **Deploy**: When convenient

### Post-Testing Actions

1. **Fix All Critical/High Findings**
   - Before production deployment
   - Verify fixes with retesting

2. **Document Security Posture**
   - Record all findings
   - Document mitigations
   - Update security documentation

3. **Schedule Regular Testing**
   - Quarterly penetration tests
   - After major feature releases
   - When significant dependencies updated

4. **Security Awareness**
   - Share learnings with team
   - Update secure coding guidelines
   - Improve security practices

### External Security Audit

**When to Engage External Auditors:**
- Before major product launch
- After significant architecture changes
- Annually for compliance
- When handling sensitive data increases

**Recommended Services:**
- HackerOne
- Bugcrowd
- Professional penetration testing firms
- Security consulting services

---

## Verification Procedures

### Quick Verification Checklist

**Test Execution:**
```bash
# Run all tests for a specific package
# Note: Package name is @revealui/core
pnpm test --filter @revealui/core

# Run specific test files
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core

# Check test count matches claims
pnpm test --filter @revealui/core 2>&1 | grep -E "Tests.*passed|Tests.*failed"
```

**Code Coverage:**
```bash
# Generate coverage report
pnpm test:coverage --filter @revealui/core

# Check coverage thresholds met
# Open coverage/index.html and verify files are covered
```

**Build Verification:**
```bash
# Ensure code compiles
pnpm build --filter @revealui/core

# Type checking
pnpm typecheck --filter @revealui/core
```

**File Existence Checks:**
```bash
# Verify test files exist
ls -la packages/core/src/core/__tests__/
# Should see: checkDependencies.test.ts, findGlobal.test.ts, fieldTraversal.test.ts

# Verify implementation files exist
ls -la packages/core/src/core/
# Should see: fieldTraversal.ts, revealui.ts (with implementations)
```

**Code Review:**
```bash
# Check if functions are implemented (not just stubs)
grep -A 20 "export.*function checkDependencies" packages/core/src/core/revealui.ts
grep -A 50 "async findGlobal" packages/core/src/core/revealui.ts

# Check if tests actually test the code
grep -A 5 "describe.*checkDependencies" packages/core/src/core/__tests__/checkDependencies.test.ts
grep -A 5 "describe.*findGlobal" packages/core/src/core/__tests__/findGlobal.test.ts
```

### Specific Verification Steps

**1. Verify "All Tests Passing" Claim:**

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

**2. Verify "Implementation Complete" Claim:**

**Step 1: Check function exists**
```bash
grep -n "export.*function checkDependencies" packages/core/src/core/revealui.ts
grep -n "async findGlobal" packages/core/src/core/revealui.ts
```

**Step 2: Check it's not just a stub**
```bash
# Check for TODO/FIXME comments
grep -A 30 "async findGlobal" packages/core/src/core/revealui.ts | grep -E "TODO|FIXME|throw.*not implemented"

# Check for actual implementation (not just throwing error)
grep -A 30 "async findGlobal" packages/core/src/core/revealui.ts | grep -v "throw.*not implemented" | head -20
```

**Step 3: Verify it matches type definition**
```bash
# Check type definition exists
grep -A 10 "findGlobal.*:" packages/core/src/core/types/index.ts
```

**3. Verify "Test Coverage Complete" Claim:**

**Step 1: Check test files exist**
```bash
test -f packages/core/src/core/__tests__/checkDependencies.test.ts && echo "✓ Exists" || echo "✗ Missing"
test -f packages/core/src/core/__tests__/findGlobal.test.ts && echo "✓ Exists" || echo "✗ Missing"
test -f packages/core/src/core/__tests__/fieldTraversal.test.ts && echo "✓ Exists" || echo "✗ Missing"
```

**Step 2: Count actual test cases**
```bash
# Count "it(" statements (actual tests)
grep -c "it(" packages/core/src/core/__tests__/checkDependencies.test.ts
grep -c "it(" packages/core/src/core/__tests__/findGlobal.test.ts
grep -c "it(" packages/core/src/core/__tests__/fieldTraversal.test.ts
```

**Step 3: Run tests and verify count**
```bash
pnpm test checkDependencies findGlobal fieldTraversal --filter @revealui/core 2>&1 | grep "Tests"
# Should match sum of individual test counts
```

### Red Flags to Watch For

**In Test Output:**
- Exit code non-zero
- "Tests failed" message
- Test count doesn't match claim
- Test files skipped that should run

**In Code:**
- Functions with only `throw new Error("not implemented")`
- TODO/FIXME comments in implementations
- Empty function bodies
- Missing type definitions

**In Reports:**
- Vague claims ("tests pass" without count)
- Claims without verification commands
- "Should work" instead of "verified working"
- No specific file paths or test names

### Trust Levels

**High Trust (Verified Independently):**
- Test output shows specific counts
- Build succeeds with exit code 0
- Files exist and can be examined
- Code reviewed manually

**Medium Trust (Probable):**
- Agent provides specific commands to run
- Agent shows file contents
- Agent acknowledges limitations

**Low Trust (Verify Before Believing):**
- Vague status reports
- Claims without evidence
- "Should work" statements
- No verification commands provided

### Recommended Workflow

**Before Trusting Any Claim:**

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

## Tools and Frameworks

### Testing Frameworks

**Vitest:**
- Modern, fast unit and integration testing
- Native ESM support
- TypeScript support out of the box
- Compatible with Jest APIs

**Playwright:**
- End-to-end testing for web applications
- Cross-browser support (Chromium, Firefox, WebKit)
- Auto-wait for elements
- Built-in test runner

**Testing Library:**
- User-centric testing utilities
- Encourages accessible markup
- Framework-agnostic core

### Load Testing Tools

**k6:**
- Modern load testing tool
- JavaScript-based test scripts
- Built-in metrics and thresholds
- Cloud integration available

**Artillery:**
- Node.js-based load testing
- YAML or JavaScript configuration
- Good for CI/CD integration

### Security Testing Tools

**OWASP ZAP:**
- Free, open-source security scanner
- Automated and manual testing
- API scanning capabilities

**Burp Suite:**
- Industry-standard web security testing
- Intercepting proxy
- Extensive plugin ecosystem

**Nuclei:**
- Fast, customizable vulnerability scanner
- Template-based scanning
- Great for automation

---

## Best Practices

### General Testing Best Practices

1. **Write Tests First (TDD)**
   - Define expected behavior before implementation
   - Ensures testable code
   - Provides living documentation

2. **Keep Tests Independent**
   - Tests should not depend on each other
   - Each test should set up its own data
   - Clean up after tests

3. **Use Descriptive Test Names**
   - Test names should describe what's being tested
   - Include the scenario and expected outcome
   - Example: "should return 401 when JWT is expired"

4. **Test Edge Cases**
   - Don't just test happy paths
   - Test boundary conditions
   - Test error handling

5. **Maintain Test Data**
   - Use factories or fixtures for test data
   - Keep test data minimal and relevant
   - Reset database state between tests

6. **Mock External Dependencies**
   - Don't hit real APIs in unit tests
   - Use test mode for third-party services
   - Mock time-dependent functions

7. **Monitor Test Performance**
   - Tests should run quickly
   - Slow tests indicate integration issues
   - Parallelize when possible

### Security Testing Best Practices

1. **Test Early and Often**
   - Integrate security testing into CI/CD
   - Don't wait until pre-production
   - Fix vulnerabilities as they're found

2. **Follow Responsible Disclosure**
   - Report vulnerabilities privately
   - Give team time to fix before public disclosure
   - Document fixes and lessons learned

3. **Use Multiple Tools**
   - No single tool catches everything
   - Combine automated and manual testing
   - Leverage different perspectives

4. **Stay Updated**
   - Keep security tools updated
   - Follow OWASP Top 10
   - Monitor security advisories for dependencies

### Load Testing Best Practices

1. **Test in Production-Like Environment**
   - Match production hardware specs
   - Use production-like data volumes
   - Test with realistic network conditions

2. **Ramp Up Gradually**
   - Don't spike to max load immediately
   - Allow system to warm up
   - Observe behavior at different load levels

3. **Monitor System Resources**
   - Track CPU, memory, disk I/O
   - Monitor database performance
   - Watch for bottlenecks

4. **Test Different Scenarios**
   - Normal load, peak load, stress load
   - Different user behavior patterns
   - Various API endpoint combinations

---

## Running Tests

### Local Development

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run load tests
pnpm --filter test test:load:auth

# Run security audit
pnpm audit --audit-level=moderate
```

### CI/CD Pipeline

Tests are automatically run on:
- Every push to `main`, `cursor`, `develop` branches
- Every pull request
- Pre-deployment to staging

See `.github/workflows/ci.yml` for CI configuration.

---

## Resources

### Official Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [k6 Documentation](https://k6.io/docs/)
- [k6 Test Examples](https://k6.io/docs/examples/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

### Platform-Specific

- [Stripe Testing](https://stripe.com/docs/testing)
- [RevealUI CMS Security Documentation](https://revealui.com/docs/security)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)

### Performance Testing

- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/api-load-testing/)

---

## Next Steps

1. ✅ Set up testing infrastructure
2. ✅ Create validation schemas
3. ✅ Add health check endpoint
4. ⏸️ Write authentication tests
5. ⏸️ Write access control tests
6. ⏸️ Write payment flow tests
7. ⏸️ Set up E2E test suite
8. ⏸️ Configure test coverage reporting
9. ⏸️ Add load testing suite
10. ⏸️ Schedule penetration testing

---

**Last Updated**: January 31, 2026
**Status**: Consolidated Testing Documentation
**Maintainer**: RevealUI Framework Team
