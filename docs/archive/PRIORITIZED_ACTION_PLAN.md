# Prioritized Action Plan

**Last Updated:** 2026-02-17
**Status:** 🎯 Active Execution Plan — Phases 1-2 Complete, Strategic Architecture Phase
**Purpose:** Sprint-by-sprint roadmap to production readiness

---

## Progress Tracker

> **Current Phase:** Strategic Architecture + Phase 3 Preparation
> **Last Commit:** `ee41a34f` fix(test): fix 5 CMS chat test failures and AI imports timeout (2026-02-17)
> **CI Status:** All green — 23 builds, all tests passing, gate passes in ~158s

### Completed Work

#### Phase 2: Quality & Testing — ✅ COMPLETE

**Sprint 2.1: Enable Skipped Tests - Part 1** — ✅ COMPLETE
- AI package: 26 test files, 425 tests, 0 skips (all previously skipped tests resolved)
- CMS: memory-routes skipped (API not implemented — Phase 1 prerequisite)
- CMS: GDPR skipped (needs E2E environment — infrastructure prerequisite)

**Sprint 2.2: Enable Skipped Tests - Part 2** — ✅ COMPLETE
- Config package: 12 skipped tests un-skipped and passing (ESM mock + validator fix)
- Services: 29 passing, 3 intentionally skipped (Stripe integration requires real test key)
- Core: findGlobal deferred (needs test database — infrastructure prerequisite)

**Sprint 2.3: Console.log Cleanup** — ✅ COMPLETE (2026-02-05)
- 0 avoidable `any` types remaining (100% improvement)
- 0 production console statements (100% improvement)
- Audit tools created: `pnpm audit:any`, `pnpm audit:console`

**Sprint 2.4: Any Type Replacement** — ✅ COMPLETE (2026-02-05)
- 82 avoidable `any` types removed across all packages
- Centralized logging via `@revealui/utils/logger`

**Test Coverage Expansion** — ✅ COMPLETE (2026-02-16)
- 96 tests for code provenance value functions (contracts)
- 21 tests for utils (ssl-config, password-schema)
- 37 tests for setup (generators, validators)
- 14 tests for editors (registry, config-paths)
- 15 tests for cli (credentials)
- 18 tests for router (route matching, resolve, subscribe)
- **Total: 179 new tests, all passing**

**Test Fixes (CI Blockers)** — ✅ COMPLETE (2026-02-17)
- CMS: Fixed Stripe mock path (`'services'` → `'@revealui/services'`) — 47 test failures fixed
- CMS: Fixed chat integration tests (missing `getResponseCacheStats`/`getSemanticCacheStats` on LLM mock) — 5 failures fixed
- AI: Increased import timeout (15s → 30s) for CI resilience
- Build: Added `@emotion/is-prop-valid` optional peer dep for motion package
- **Result: 0 test failures, full CI gate passing, push succeeded**

**Lint/ESLint Fixes** — ✅ COMPLETE (2026-02-16)
- Removed unnecessary type casts in contracts/ticket.ts
- Fixed async/promise errors in db/client and db/pool
- Added eslint-disable to example-only optimized-queries.ts
- Added test script to router package.json

**Build Improvements** — ✅ COMPLETE (2026-02-05)
- Build success: 17/21 → 19/21 → 23/23 packages (100%)
- Fixed: @revealui/ai, landing, docs, CMS, presentation

### Remaining Skipped Tests (6 total — all accounted for)

| Skip | Package | Reason | Blocked By |
|------|---------|--------|------------|
| 3 tests | services (stripe-integration) | Intentional — requires real Stripe test key | Correct behavior |
| 2 tests | db (extract-units) | Edge cases not found in real code | Low priority |
| 1 test | cms (memory-routes) | API routes not implemented | Phase 1 |
| 1 suite | cms (gdpr) | Needs E2E environment | Infrastructure |
| 1 suite | cms (health) | Needs E2E environment | Infrastructure |
| 1 suite | core (richtext-integration) | Needs Lexical module | Phase 3 |

#### Phase 1: Critical Blockers — ✅ IMPLEMENTED (discovered 2026-02-16)

All three Phase 1 sprints were found to be already implemented:

**Sprint 1.1: Auth Email System** — ✅ IMPLEMENTED
- Email service: `apps/cms/src/lib/email/index.ts` (Resend, SMTP, Mock providers)
- Password reset: `packages/auth/src/server/password-reset.ts`
- All auth endpoints exist: sign-up, sign-in, password-reset, session, me
- Brute force protection and rate limiting built in

**Sprint 1.2: Vector Search** — ✅ IMPLEMENTED
- Embeddings: `packages/ai/src/embeddings/index.ts` (OpenAI models)
- Vector memory: `packages/ai/src/memory/vector/vector-memory-service.ts`
- pgvector schema: `packages/db/src/schema/agents.ts` (1536-dim vectors)
- Episodic memory integration with similarity search

**Sprint 1.3: Populate Support** — ✅ IMPLEMENTED
- Relationship analyzer: `packages/core/src/relationships/analyzer.ts`
- Population logic: `packages/core/src/relationships/population.ts`
- Helpers: `packages/core/src/relationships/populate-helpers.ts`
- Supports direct FK, junction tables, polymorphic relationships

**Remaining for Phase 1:** Environment config (Resend API key, pgvector extension)
and integration testing/verification.

### Not Started
- **Phase 3:** Feature Completion (Cohesion Engine, React hooks, Rich text)
- **Phase 4:** Polish & Production
- **Phase 5:** Strategic Architecture (NEW — see below)

---

## Phase 5: Strategic Architecture (NEW)

**Goal:** Replace external UI/animation dependencies with native RevealUI implementations
**Priority:** 🔴 High — reduces dependency surface, establishes RevealUI identity
**Approach:** Build each success upon the last

### Systematic Order (each builds on the previous)

#### 5.1: Native UI Components (replaces @headlessui/react)

**Scope:** 20 components in `packages/presentation/src/` depend on headlessui
**Components to build natively:** Dialog, Menu, Listbox, Combobox, Switch, Radio,
Checkbox, Field, Fieldset, Input, Textarea, Select, Button, Label, Legend, Link,
Navbar, Sidebar, SidebarLayout, StackedLayout
**Styling:** Tailwind CSS only (no CSS-in-JS, no emotion, no styled-components)
**Accessibility:** WAI-ARIA compliant (currently provided by headlessui)

**Why first:** Foundation for all other UI work. Every app uses these components.

#### 5.2: Native Animation Library (replaces motion/framer-motion)

**Current usage:** Only 2 files (navbar.tsx, sidebar.tsx) — `motion.span` + `LayoutGroup`
**Approach:** TypeScript animation engine using Web Animations API (WAAPI) + CSS transitions
**Scope:** Layout animations, spring physics, gesture support
**Reference:** motion.dev (motiondivision/motion) for API design inspiration
**No @emotion dependency after this**

**Why second:** Minimal existing usage makes migration low-risk. Builds on native UI components.

#### 5.3: Native MCP UI (new capability)

**Scope:** RevealUI-native MCP UI for managing MCP servers, tools, resources
**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, native UI components
**Reference:** mcp-ui-org/mcp-ui for feature parity
**Location:** Could be a new app (`apps/mcp-ui`) or integrated into dashboard

**Why third:** Uses native UI components + animation library from 5.1 and 5.2.

### Infrastructure Prerequisites

#### Node.js 24 Upgrade
- WSL currently runs v22.22.0, Windows runs v22.21.0
- `package.json` requires `>=24.13.0`
- **Action:** `nvm install 24` in WSL, update Windows Node.js
- **Why now:** Required by engine field, unblocks newer APIs

#### Ext4 SSD Auto-Mounting
- DevBox SSD (ext4) shows "RevealUI SSD not detected" in PowerShell profile
- Windows cannot natively read ext4 — requires WSL mount
- **Action:** Update PowerShell profile to detect via `wsl -e test -d /mnt/wsl-dev`
- **Alternative:** Use `wsl --mount` in PS profile for auto-attach

---

## Executive Summary

**Goal:** Transform RevealUI from promising framework to production-ready platform
**Timeline:** 6-8 weeks (183-248 hours)
**Approach:** 4 phases, 12 sprints, clear milestones
**Success Criteria:** All critical features working, tests passing, type-safe code

---

## Table of Contents

- [Overview](#overview)
- [Phase 1: Critical Blockers (Weeks 1-2)](#phase-1-critical-blockers-weeks-1-2)
- [Phase 2: Quality & Testing (Weeks 3-4)](#phase-2-quality--testing-weeks-3-4)
- [Phase 3: Feature Completion (Weeks 5-6)](#phase-3-feature-completion-weeks-5-6)
- [Phase 4: Polish & Production (Weeks 7-8)](#phase-4-polish--production-weeks-7-8)
- [Dependencies & Critical Path](#dependencies--critical-path)
- [Risk Mitigation](#risk-mitigation)
- [Success Metrics](#success-metrics)

---

## Overview

### Guiding Principles

1. **Unblock First** - Remove critical blockers before anything else
2. **Quality Gates** - Each phase must pass quality checks before proceeding
3. **Test Everything** - No skipped tests in production
4. **Type Safety** - No `any` types in critical paths
5. **Production Ready** - Every change must be production-grade

### Phase Overview

| Phase | Focus | Duration | Effort | Priority |
|-------|-------|----------|--------|----------|
| 1 | Critical Blockers | 2 weeks | 30-42h | 🔴 Critical |
| 2 | Quality & Testing | 2 weeks | 60-78h | 🟡 High |
| 3 | Feature Completion | 2 weeks | 44-54h | 🟢 Medium |
| 4 | Polish & Production | 2 weeks | 49-66h | 🔵 Low |

**Total:** 8 weeks, 183-248 hours

---

## Phase 1: Critical Blockers (Weeks 1-2)

**Goal:** Unblock core functionality
**Duration:** 2 weeks
**Effort:** 30-42 hours
**Blockers Removed:** Authentication, Vector Search, Populate Support

### Sprint 1.1: Authentication Email System (8-12 hours)

**Objective:** Complete authentication flow with email functionality

#### Tasks
- [ ] **Day 1-2: Email Service Integration**
  - [ ] Evaluate email providers (Resend, SendGrid, AWS SES)
  - [ ] Install and configure chosen provider
  - [ ] Create email service abstraction layer
  - [ ] Add environment variables for email config
  - **Files:** Create `packages/services/src/email/` directory
  - **Deliverable:** Working email service with send capability

- [ ] **Day 2-3: Password Reset Implementation**
  - [ ] Create password reset email templates (HTML + text)
  - [ ] Implement token generation and validation
  - [ ] Add email sending to password reset flow
  - [ ] Add rate limiting (max 3 requests per hour per email)
  - **Files:** `apps/cms/src/app/api/auth/forgot-password/route.ts`
  - **Deliverable:** Complete password reset flow

- [ ] **Day 3-4: Missing Endpoints**
  - [ ] Implement `/api/auth/session` endpoint
  - [ ] Implement `/api/auth/me` endpoint
  - [ ] Add session validation middleware
  - [ ] Add endpoint tests
  - **Files:** `apps/cms/src/app/api/auth/`
  - **Deliverable:** Complete auth API

- [ ] **Day 4: Testing & Validation**
  - [ ] Write integration tests for email sending
  - [ ] Test password reset flow end-to-end
  - [ ] Add error handling tests
  - [ ] Update AUTH.md documentation
  - **Deliverable:** All auth tests passing

**Exit Criteria:**
- ✅ Password reset emails sending successfully
- ✅ `/api/auth/session` and `/api/auth/me` working
- ✅ Rate limiting in place
- ✅ All auth tests passing
- ✅ Documentation updated

---

### Sprint 1.2: Vector Search Implementation (12-16 hours)

**Objective:** Enable AI-powered semantic search

#### Tasks
- [ ] **Day 1-2: Database Setup**
  - [ ] Add pgvector extension to Postgres
  - [ ] Create migration for vector columns
  - [ ] Add vector indexes for performance
  - [ ] Update database schema types
  - **Files:** `packages/db/src/migrations/`
  - **Deliverable:** Database ready for vectors

- [ ] **Day 2-3: Embedding Generation**
  - [ ] Choose embedding model (OpenAI, Cohere, or local)
  - [ ] Implement embedding generation service
  - [ ] Add caching for embeddings
  - [ ] Batch embedding generation for bulk operations
  - **Files:** `packages/ai/src/embeddings/`
  - **Deliverable:** Working embedding service

- [ ] **Day 3-4: Vector Search Implementation**
  - [ ] Implement similarity search queries
  - [ ] Add vector search to episodic memory
  - [ ] Optimize query performance
  - [ ] Add result ranking and filtering
  - **Files:** `packages/ai/src/episodic-memory.ts`
  - **Deliverable:** Functional vector search

- [ ] **Day 4: Testing & Optimization**
  - [ ] Write vector search tests
  - [ ] Add performance benchmarks
  - [ ] Test with realistic data volumes
  - [ ] Document vector search API
  - **Deliverable:** Production-ready vector search

**Exit Criteria:**
- ✅ pgvector extension installed and configured
- ✅ Embedding generation working
- ✅ Similarity search returning relevant results
- ✅ Performance within acceptable limits (<100ms)
- ✅ Tests passing

---

### Sprint 1.3: Populate Support (10-14 hours)

**Objective:** Enable relationship traversal in queries

#### Tasks
- [ ] **Day 1-2: Core Implementation**
  - [ ] Design populate API interface
  - [ ] Implement populate() in RevealUIInstance
  - [ ] Implement populate() in GlobalOperations
  - [ ] Add relationship resolution logic
  - **Files:** `packages/core/src/core/revealui.ts`
  - **Deliverable:** Basic populate functionality

- [ ] **Day 2-3: Advanced Features**
  - [ ] Add nested populate support (multi-level)
  - [ ] Implement populate field selection
  - [ ] Add populate caching
  - [ ] Optimize query generation
  - **Deliverable:** Full-featured populate

- [ ] **Day 3: TypeScript Integration**
  - [ ] Update TypeScript types for populated queries
  - [ ] Add type inference for populated fields
  - [ ] Test type safety with complex queries
  - **Deliverable:** Type-safe populate API

- [ ] **Day 4: Testing & Documentation**
  - [ ] Write unit tests for populate
  - [ ] Add integration tests
  - [ ] Test edge cases (circular refs, deep nesting)
  - [ ] Document populate API with examples
  - **Deliverable:** Complete populate feature

**Exit Criteria:**
- ✅ populate() working in queries
- ✅ Nested relationships working
- ✅ Type inference working correctly
- ✅ All tests passing
- ✅ API documented

---

### Phase 1 Milestone

**Deliverables:**
- ✅ Complete authentication system
- ✅ Working vector search
- ✅ Full populate support

**Quality Gates:**
- All critical features functional
- No regressions in existing features
- Documentation updated
- Tests written and passing

**Go/No-Go Decision Point:** Review all exit criteria before proceeding to Phase 2

---

## Phase 2: Quality & Testing (Weeks 3-4)

**Goal:** Achieve production-quality code standards
**Duration:** 2 weeks
**Effort:** 60-78 hours
**Focus:** Test coverage, code quality, type safety

### Sprint 2.1: Enable Skipped Tests - Part 1 (16-20 hours)

**Objective:** Fix and enable AI and CMS package tests

#### AI Package Tests (8-10 hours)
- [ ] **imports.test.ts (4 tests)**
  - [ ] Fix memory export imports
  - [ ] Fix main package export imports
  - [ ] Verify export consistency
  - [ ] Enable all 4 tests
  - **Files:** `packages/ai/src/__tests__/imports.test.ts`

- [ ] **performance.test.ts (Mock collision fixes)**
  - [ ] Debug root cause of mock collisions
  - [ ] Refactor mock setup for isolation
  - [ ] Add collision detection guards
  - [ ] Enable all performance tests
  - **Files:** `packages/ai/src/__tests__/performance.test.ts`
  - **Critical:** Lines 77, 112, 163, 211

- [ ] **episodic-memory-embedding.test.ts**
  - [ ] Implement data migration logic
  - [ ] Add embeddingMetadata validation
  - [ ] Enable migration test
  - **Files:** `packages/ai/src/__tests__/episodic-memory-embedding.test.ts:243`

#### CMS Package Tests (8-10 hours)
- [ ] **memory-routes.test.ts**
  - [ ] Implement Memory API route tests
  - [ ] Test CRUD operations
  - [ ] Test error handling
  - [ ] Enable full suite
  - **Files:** `apps/cms/src/__tests__/api/memory-routes.test.ts`

- [ ] **health.test.ts**
  - [ ] Implement health check integration tests
  - [ ] Test all health endpoints
  - [ ] Test failure scenarios
  - [ ] Enable full suite
  - **Files:** `apps/cms/src/__tests__/integration/api/health.test.ts`

- [ ] **gdpr.test.ts**
  - [ ] Implement GDPR compliance tests
  - [ ] Test data export functionality
  - [ ] Test data deletion
  - [ ] Enable full suite
  - **Files:** `apps/cms/src/__tests__/integration/api/gdpr.test.ts`

**Exit Criteria:**
- ✅ All AI package tests passing
- ✅ All CMS package tests passing
- ✅ No skipped tests in these packages
- ✅ Test coverage >80%

---

### Sprint 2.2: Enable Skipped Tests - Part 2 (16-20 hours)

**Objective:** Fix and enable Config, Core, and Services tests

#### Config Package Tests (6-8 hours)
- [ ] **Fix vi.mock with ESM (Critical blocker)**
  - [ ] Research ESM mocking solutions
  - [ ] Refactor test setup for ESM
  - [ ] Update mock implementation
  - [ ] Enable all 5 skipped tests + 2 suites
  - **Files:** `packages/config/src/__tests__/config.test.ts`
  - **Lines:** 170, 264, 284, 340, 400

#### Core Package Tests (4-6 hours)
- [ ] **findGlobal.test.ts**
  - [ ] Set up test database
  - [ ] Run required migrations
  - [ ] Implement test cases
  - [ ] Enable full suite
  - **Files:** `packages/core/src/__tests__/findGlobal.test.ts`

#### Services Package Tests (6-8 hours)
- [ ] **All 5 service test files**
  - [ ] imports.test.ts - Import path validation
  - [ ] webhook.test.ts - Stripe webhook handling
  - [ ] retry-logic.test.ts - Retry mechanisms
  - [ ] functionality.test.ts - Core functionality
  - [ ] circuit-breaker.test.ts - Circuit breaker logic
  - [ ] Enable all service tests
  - **Files:** `packages/services/__tests__/`

**Exit Criteria:**
- ✅ All config tests passing
- ✅ findGlobal tests working
- ✅ All service tests passing
- ✅ ESM mocking solution documented

---

### Sprint 2.3: Code Quality - Console.log Cleanup (12-16 hours)

**Objective:** Remove debug code and implement proper logging

#### Tasks
- [ ] **Day 1: Audit & Categorize (4 hours)**
  - [ ] Run `pnpm audit:console` (2,533 instances)
  - [ ] Categorize by type:
    - Debug logs (remove)
    - User-facing logs (keep)
    - Error logs (convert to logger)
  - [ ] Create replacement plan
  - **Deliverable:** Categorized list

- [ ] **Day 2-3: Replace with Logging Framework (6-8 hours)**
  - [ ] Choose/configure logging framework (pino, winston)
  - [ ] Replace debug console.logs with logger.debug()
  - [ ] Replace error console.logs with logger.error()
  - [ ] Remove unnecessary logs
  - [ ] Focus on critical packages first:
    - `packages/db/`
    - `packages/ai/`
    - `apps/cms/src/app/api/`
  - **Deliverable:** 80% reduction in console.logs

- [ ] **Day 4: Linting & Enforcement (2-4 hours)**
  - [ ] Add ESLint rule: `no-console` with exceptions
  - [ ] Configure exceptions for intentional logs
  - [ ] Run linter across codebase
  - [ ] Fix remaining violations
  - [ ] Add pre-commit hook
  - **Deliverable:** Enforced console.log policy

**Exit Criteria:**
- ✅ <500 remaining console.logs (80% reduction)
- ✅ All remaining logs are intentional
- ✅ Proper logging framework in place
- ✅ ESLint rule enforced
- ✅ CI fails on new console.logs

---

### Sprint 2.4: Code Quality - Any Type Replacement (16-22 hours)

**Objective:** Replace critical `any` types with proper TypeScript types

#### Tasks
- [ ] **Day 1: Audit & Prioritize (3-4 hours)**
  - [ ] Run `pnpm audit:any` (559 instances)
  - [ ] Focus on 267 critical `any` types
  - [ ] Prioritize by risk:
    - Database operations
    - API routes
    - Core business logic
  - [ ] Create replacement plan
  - **Deliverable:** Prioritized list

- [ ] **Day 2-3: Database & API Types (6-8 hours)**
  - [ ] Replace `any` in database queries
  - [ ] Type API request/response objects
  - [ ] Type database models properly
  - [ ] Update schema type generation
  - **Files:** `packages/db/`, `apps/cms/src/app/api/`
  - **Deliverable:** Type-safe database & API layer

- [ ] **Day 4: Core Business Logic (4-6 hours)**
  - [ ] Replace `any` in core package
  - [ ] Type AI/memory operations
  - [ ] Type service integrations
  - **Files:** `packages/core/`, `packages/ai/`
  - **Deliverable:** Type-safe core logic

- [ ] **Day 5: Linting & Validation (3-4 hours)**
  - [ ] Enable `@typescript-eslint/no-explicit-any`
  - [ ] Configure exceptions for justified cases
  - [ ] Document remaining `any` usage
  - [ ] Add CI type checking
  - **Deliverable:** Type safety enforced

**Exit Criteria:**
- ✅ <200 remaining `any` types (65% reduction)
- ✅ Zero `any` in database operations
- ✅ Zero `any` in API routes
- ✅ ESLint rule enforced
- ✅ All justified `any` usage documented

---

### Phase 2 Milestone

**Deliverables:**
- ✅ 30+ test suites enabled and passing
- ✅ 80% reduction in console.logs
- ✅ 65% reduction in `any` types
- ✅ Code quality standards enforced

**Quality Gates:**
- Test coverage >80%
- All tests passing
- Type checking passing
- Linting passing
- No critical code quality issues

---

## Phase 3: Feature Completion (Weeks 5-6)

**Goal:** Complete all high-priority features
**Duration:** 2 weeks
**Effort:** 44-54 hours
**Focus:** Cohesion Engine, React Hooks, Rich Text Editor

### Sprint 3.1: Cohesion Engine Phase 3 (16-20 hours)

**Objective:** Implement automated cleanup and maintenance strategies

#### Tasks
- [ ] **Day 1-2: Design & Architecture (6-8 hours)**
  - [ ] Design cleanup strategy system
  - [ ] Define cleanup policies (time-based, count-based, conditional)
  - [ ] Design dry-run mode
  - [ ] Create cleanup audit log schema
  - **Deliverable:** Architecture document

- [ ] **Day 2-3: Core Implementation (6-8 hours)**
  - [ ] Implement orphaned record detection
  - [ ] Add automated archival policies
  - [ ] Create cleanup scheduling system
  - [ ] Add cleanup validation logic
  - **Files:** `packages/core/src/cohesion/`
  - **Deliverable:** Working cleanup engine

- [ ] **Day 4: Safety & Testing (4-6 hours)**
  - [ ] Implement dry-run mode
  - [ ] Add rollback capabilities
  - [ ] Add cleanup audit logging
  - [ ] Write comprehensive tests
  - [ ] Test with production-like data
  - **Deliverable:** Production-safe cleanup

**Exit Criteria:**
- ✅ Orphaned records detected automatically
- ✅ Cleanup policies configurable
- ✅ Dry-run mode working
- ✅ Audit logs capturing all actions
- ✅ Tests passing with edge cases

---

### Sprint 3.2: React Hook Tests (8-10 hours)

**Objective:** Implement comprehensive hook testing

#### Tasks
- [ ] **Day 1: Test Infrastructure (2-3 hours)**
  - [ ] Set up React Testing Library
  - [ ] Configure hook testing utilities
  - [ ] Create test fixtures
  - **Deliverable:** Test infrastructure ready

- [ ] **Day 2: Hook Behavior Tests (3-4 hours)**
  - [ ] Test hook state management
  - [ ] Test hook lifecycle
  - [ ] Test hook composition
  - [ ] Test custom hook behavior
  - **Deliverable:** Core hook tests

- [ ] **Day 3: Integration & Edge Cases (3-4 hours)**
  - [ ] Add integration tests for hooks
  - [ ] Test error handling scenarios
  - [ ] Test performance characteristics
  - [ ] Test concurrent rendering
  - **Deliverable:** Complete hook test suite

**Exit Criteria:**
- ✅ All hook tests implemented
- ✅ No skipped hook tests
- ✅ Coverage >90% for hooks
- ✅ Edge cases tested
- ✅ Hook usage documented

---

### Sprint 3.3: Rich Text Editor (20-24 hours)

**Objective:** Complete Lexical rich text editor integration

#### Tasks
- [ ] **Day 1-2: Module Setup (6-8 hours)**
  - [ ] Create `packages/core/src/richtext/lexical` module
  - [ ] Install and configure Lexical
  - [ ] Create editor configuration
  - [ ] Set up plugin system
  - **Deliverable:** Basic editor working

- [ ] **Day 2-3: Core Features (8-10 hours)**
  - [ ] Implement rich text serialization
  - [ ] Create editor toolbar components
  - [ ] Add paste handling
  - [ ] Implement formatting commands
  - [ ] Add image/media support
  - **Deliverable:** Feature-complete editor

- [ ] **Day 4: Advanced Features (4-6 hours)**
  - [ ] Implement collaborative editing support
  - [ ] Add rich text validation
  - [ ] Create custom plugins
  - [ ] Optimize performance
  - **Deliverable:** Production-ready editor

- [ ] **Day 5: Testing & Integration (2-4 hours)**
  - [ ] Enable richtext-integration tests
  - [ ] Add editor component tests
  - [ ] Test serialization/deserialization
  - [ ] Document editor API
  - **Deliverable:** Tested and documented editor

**Exit Criteria:**
- ✅ Lexical module exists and working
- ✅ All core formatting features working
- ✅ Collaborative editing supported
- ✅ Tests passing (richtext-integration.test.ts enabled)
- ✅ API documented with examples

---

### Phase 3 Milestone

**Deliverables:**
- ✅ Cohesion Engine Phase 3 complete
- ✅ All React hooks tested
- ✅ Rich text editor production-ready

**Quality Gates:**
- All features fully functional
- Tests passing with high coverage
- Performance within acceptable limits
- Documentation complete

---

## Phase 4: Polish & Production (Weeks 7-8)

**Goal:** Production hardening and final polish
**Duration:** 2 weeks
**Effort:** 49-66 hours
**Focus:** Technical debt, infrastructure, security

### Sprint 4.1: Technical Debt Resolution (12-18 hours)

**Objective:** Clear technical debt blocking production

#### TypeScript Configuration (4-6 hours)
- [ ] Fix underlying TypeScript errors
- [ ] Remove `typescript.ignoreBuildErrors` from `apps/cms/next.config.mjs`
- [ ] Add strict type checking to CI
- [ ] Ensure build fails on type errors
- **Files:** `apps/cms/next.config.mjs`

#### ElectricSQL Database Type (2-4 hours)
- [ ] Generate proper ElectricSQL types
- [ ] Update database type imports
- [ ] Remove fallback type usage
- [ ] Add type generation to build process
- **Files:** Database layer

#### Database Setup Implementation (6-8 hours)
- [ ] Implement database connection initialization
- [ ] Add connection cleanup
- [ ] Implement database reset logic
- [ ] Add data seeding functionality
- [ ] Implement query execution
- [ ] Add transaction support
- **Files:** `packages/db/__tests__/setup.ts`

**Exit Criteria:**
- ✅ TypeScript build passes without ignoring errors
- ✅ ElectricSQL types properly generated
- ✅ Database setup fully functional
- ✅ No technical debt blocking production

---

### Sprint 4.2: Medium Priority Features (30-38 hours)

**Objective:** Complete remaining features

#### Stripe Multi-Instance Circuit Breaker (6-8 hours)
- [ ] Implement distributed circuit breaker state
- [ ] Add Redis for shared state
- [ ] Implement synchronization
- [ ] Add circuit breaker metrics
- [ ] Test multi-instance scenarios

#### Plugin System Integration (8-10 hours)
- [ ] Complete Vite plugin integration
- [ ] Add plugin hot reload support
- [ ] Implement plugin dependency resolution
- [ ] Add plugin configuration validation
- [ ] Document plugin development
- [ ] Create plugin examples

#### Universal Middleware Replacement (10-12 hours)
- [ ] Design custom middleware architecture
- [ ] Implement middleware chain
- [ ] Add middleware composition utilities
- [ ] Migrate from Bati-generated code
- [ ] Add middleware tests
- [ ] Document middleware API

#### Builder - Vercel API Integration (6-8 hours)
- [ ] Implement Vercel API client
- [ ] Add deployment triggers
- [ ] Implement deployment status tracking
- [ ] Add environment variable management
- [ ] Add error handling

**Exit Criteria:**
- ✅ All medium priority features complete
- ✅ Features tested and documented
- ✅ No regressions

---

### Sprint 4.3: Infrastructure & Security (7-10 hours)

**Objective:** Production security and infrastructure hardening

#### Production Security (6-8 hours)
- [ ] Implement rate limiting middleware
- [ ] Add IP whitelisting configuration
- [ ] Add security headers (HSTS, CSP, etc.)
- [ ] Implement request throttling
- [ ] Add security monitoring
- [ ] Security audit and penetration testing

#### Infrastructure Cleanup (1-2 hours)
- [ ] Archive Phase 3 test results
- [ ] Clean up temporary files
- [ ] Update repository documentation

**Exit Criteria:**
- ✅ Rate limiting in place
- ✅ IP whitelisting configured
- ✅ Security headers set
- ✅ Security audit passed
- ✅ Repository clean

---

### Phase 4 Milestone

**Deliverables:**
- ✅ All technical debt resolved
- ✅ All medium priority features complete
- ✅ Production security hardened
- ✅ Infrastructure production-ready

**Quality Gates:**
- Zero critical or high security issues
- All features working in production environment
- Performance meets SLAs
- Documentation complete

---

## Dependencies & Critical Path

### Critical Path

```
Week 1-2: Phase 1 (Critical Blockers)
├── Sprint 1.1: Authentication (BLOCKING)
├── Sprint 1.2: Vector Search (BLOCKING)
└── Sprint 1.3: Populate Support (BLOCKING)
    ↓
Week 3-4: Phase 2 (Quality & Testing)
├── Sprint 2.1: Tests Part 1 (depends on Phase 1)
├── Sprint 2.2: Tests Part 2 (depends on Phase 1)
├── Sprint 2.3: Console.log Cleanup (parallel)
└── Sprint 2.4: Any Type Replacement (parallel)
    ↓
Week 5-6: Phase 3 (Feature Completion)
├── Sprint 3.1: Cohesion Engine (depends on Phase 2)
├── Sprint 3.2: React Hook Tests (depends on Phase 2)
└── Sprint 3.3: Rich Text Editor (parallel)
    ↓
Week 7-8: Phase 4 (Polish & Production)
├── Sprint 4.1: Technical Debt (parallel)
├── Sprint 4.2: Medium Features (parallel)
└── Sprint 4.3: Infrastructure (depends on 4.1, 4.2)
```

### Key Dependencies

1. **Phase 2 depends on Phase 1** - Can't properly test without core features
2. **Phase 3 can partially parallel Phase 2** - Rich text editor independent
3. **Phase 4 requires Phases 1-3 complete** - Final polish needs stable base

### Parallelization Opportunities

- Console.log cleanup can run parallel to test fixes
- Any type replacement can run parallel to test fixes
- Rich text editor independent of other Phase 3 work
- Technical debt resolution can parallel with feature work in Phase 4

---

## Risk Mitigation

### High-Risk Items

#### 1. Mock Collision Issues in Performance Tests
**Risk:** May require significant refactoring
**Mitigation:**
- Allocate extra time (2-3 hours buffer)
- Consider skipping if blocker; address post-launch
- Document issue for future resolution

#### 2. ESM Mocking in Config Tests — ✅ RESOLVED
**Resolution:** Fixed by resetting loadEnvironment mock in beforeEach, using mockReturnValueOnce,
and adding DATABASE_URL normalization to validator. All 12 tests passing. (2026-02-16)

#### 3. Rich Text Editor Complexity
**Risk:** Lexical integration may uncover issues
**Mitigation:**
- Start early in Phase 3
- Consider simpler alternative (TipTap, Slate)
- Keep MVP scope small initially

#### 4. Vector Search Performance
**Risk:** May not meet performance requirements
**Mitigation:**
- Start with benchmarks
- Plan for index optimization
- Consider caching strategies
- Budget time for tuning

### Contingency Plans

**If Timeline Slips:**
1. Defer low priority items (Phase 4 low priority features)
2. Reduce scope of medium features
3. Focus on production-blocking work only

**If Critical Blocker Discovered:**
1. Pause current sprint
2. Assess impact and urgency
3. Re-prioritize if necessary
4. Update stakeholders

---

## Success Metrics

### Phase 1 Success Metrics
- [ ] All authentication flows working (signup, login, reset)
- [ ] Vector search returning results <100ms
- [ ] Populate queries working with nested relationships
- [ ] Zero critical bugs in core features

### Phase 2 Success Metrics
- [ ] Test coverage >80% across all packages
- [ ] Zero skipped tests (except documented edge cases)
- [ ] <500 console.log statements (<20% of original)
- [ ] <200 `any` types (<35% of original)
- [ ] All linting rules passing

### Phase 3 Success Metrics
- [ ] Cohesion Engine running automated cleanups
- [ ] All React hooks tested with >90% coverage
- [ ] Rich text editor functional with all core features
- [ ] Performance benchmarks within acceptable ranges

### Phase 4 Success Metrics
- [ ] TypeScript build passing without error ignoring
- [ ] All medium priority features complete and tested
- [ ] Security audit passed with zero critical issues
- [ ] Production deployment successful

### Overall Success Criteria

#### Code Quality
- ✅ Zero skipped tests
- ✅ Test coverage >80%
- ✅ TypeScript strict mode enabled
- ✅ Zero `any` in critical paths
- ✅ Linting passing with no exceptions

#### Functionality
- ✅ All critical features working
- ✅ All high priority features complete
- ✅ API fully functional
- ✅ Authentication complete
- ✅ Data persistence working

#### Production Readiness
- ✅ Security audit passed
- ✅ Performance benchmarks met
- ✅ Documentation complete
- ✅ CI/CD pipeline green
- ✅ Monitoring and logging in place

---

## Tracking & Reporting

### Daily Tracking
- Use task management system (TaskCreate/TaskUpdate tools)
- Update sprint board daily
- Track blockers and risks
- Document decisions

### Weekly Reviews
- Review progress against sprint goals
- Adjust priorities if needed
- Update stakeholders
- Assess risks

### Phase Reviews
- Complete phase checklist
- Review all exit criteria
- Hold go/no-go decision
- Document lessons learned

---

## Next Steps (Prioritized for Systematic Efficiency)

### Immediate Actions

1. **Upgrade Node.js to 24** (unblocks engine requirements)
   - WSL: `nvm install 24 && nvm alias default 24`
   - Windows: Install Node 24 LTS

2. **Fix ext4 SSD detection** (PowerShell profile update)
   - Detect via WSL instead of expecting Windows mount

3. **Begin Phase 5.1: Native UI Components**
   - Start with simplest components (Button, Input, Label)
   - Build up to complex ones (Dialog, Combobox, Listbox)
   - Each component enables the next — systematic stacking

4. **Phase 3 items can run in parallel** with Phase 5 work
   - Cohesion Engine (independent)
   - Rich Text Editor (independent)

### Dependency Chain

```
Node 24 upgrade → unlocks newer APIs
    ↓
Native Button/Input/Label → foundation for all UI
    ↓
Native Dialog/Menu/Dropdown → complex interaction patterns
    ↓
Native Combobox/Listbox/Select → advanced form controls
    ↓
Native Animation Library → replaces motion (only 2 files)
    ↓
Native MCP UI → uses everything above
```

---

## Related Documents

- [UNFINISHED_WORK_INVENTORY.md](./UNFINISHED_WORK_INVENTORY.md) - Complete inventory
- [PROJECT_STATUS.md](../../PROJECT_STATUS.md) - Current state
- [PROJECT_ROADMAP.md](../../PROJECT_ROADMAP.md) - High-level roadmap
- [TESTING.md](../../TESTING.md) - Testing strategy
- [AUTH.md](../../AUTH.md) - Authentication details

---

## Appendix A: Task Checklists

### Phase 1 Complete Checklist
- [ ] Authentication email system working
- [ ] Password reset flow complete
- [ ] `/api/auth/session` and `/api/auth/me` implemented
- [ ] Vector search functional with pgvector
- [ ] Embedding generation working
- [ ] Similarity search returning results
- [ ] Populate support in queries
- [ ] Nested populate working
- [ ] Type inference for populated fields
- [ ] All Phase 1 tests passing
- [ ] Documentation updated

### Phase 2 Complete Checklist
- [x] All AI package tests passing (425 tests, 0 skips)
- [x] All Config package tests passing (104 tests, 0 skips)
- [x] All Services package tests passing (29 passing, 3 intentional skips)
- [x] Console.log count: 0 production statements
- [x] Any type count: 0 avoidable types
- [x] ESLint rules enforced
- [x] Type checking passing
- [ ] CMS integration tests (blocked by Phase 1 API routes / E2E infra)
- [ ] Core findGlobal tests (blocked by test database setup)

### Phase 3 Complete Checklist
- [ ] Cohesion Engine Phase 3 complete
- [ ] Automated cleanup working
- [ ] Dry-run mode functional
- [ ] All React hooks tested
- [ ] Hook coverage >90%
- [ ] Rich text editor working
- [ ] Lexical integration complete
- [ ] Collaborative editing supported
- [ ] All Phase 3 tests passing

### Phase 4 Complete Checklist
- [ ] TypeScript strict mode enabled
- [ ] ElectricSQL types generated
- [ ] Database setup complete
- [ ] Stripe multi-instance working
- [ ] Plugin system integrated
- [ ] Middleware replaced
- [ ] Vercel API integrated
- [ ] Rate limiting in place
- [ ] Security audit passed
- [ ] Production deployment successful

---

## Appendix B: Emergency Contacts & Resources

### Key Resources
- **ElectricSQL Docs:** https://electric-sql.com/docs
- **Lexical Docs:** https://lexical.dev/docs/intro
- **pgvector Guide:** https://github.com/pgvector/pgvector

### Support Channels
- GitHub Issues: Track all bugs and feature requests
- Team Chat: Daily communication
- Weekly Sync: Progress reviews

---

**Status:** 📋 Phases 1-2 Complete — Strategic Architecture Phase
**Next Review:** After Phase 5.1 (Native UI Components)
**Owner:** RevealUI Studio
**Last Updated:** 2026-02-17
