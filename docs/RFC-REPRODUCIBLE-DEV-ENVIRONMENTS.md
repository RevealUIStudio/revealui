# RFC: Reproducible Development Environments for RevealUI

**Status:** DRAFT - Pending Review
**Created:** 2026-01-30
**Author:** Implementation Team
**Reviewers:** RevealUI Core Team

---

## Executive Summary

This RFC proposes enhancements to RevealUI's development environment initialization through three initiatives:

1. **Hybrid DX Approach** - create-revealui CLI + Dev Containers + Devbox
2. **RevealUI Cloud** - Managed SaaS platform (long-term)
3. **Nix Server POC** - Infrastructure validation

**⚠️ CRITICAL FINDING:** Comprehensive codebase analysis reveals significant overlap with existing infrastructure. This RFC recommends **refactoring the approach to leverage existing packages** rather than creating duplicate functionality.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Overlap Analysis](#overlap-analysis)
3. [Proposed Architecture](#proposed-architecture)
4. [Implementation Status](#implementation-status)
5. [Recommendations](#recommendations)
6. [Migration Path](#migration-path)
7. [Open Questions](#open-questions)
8. [Decision Log](#decision-log)

---

## Current State Analysis

### Existing Infrastructure (Pre-RFC)

RevealUI already has comprehensive setup infrastructure:

#### 1. Packages (11 Total)

| Package | Purpose | Relevance to RFC |
|---------|---------|------------------|
| `@revealui/config` | Type-safe environment configuration | **HIGH** - Should validate create-revealui output |
| `@revealui/db` | Database with Drizzle ORM | **HIGH** - Used by database installers |
| `@revealui/core` | CMS framework | **MEDIUM** - Core dependency |
| `@revealui/auth` | Authentication system | **MEDIUM** - Cloud platform auth |
| `dev` | Development tooling | **HIGH** - Shared build configs |
| Other 6 packages | Various functionality | **LOW-MEDIUM** |

#### 2. Setup Scripts (`/scripts/setup/` - 22 scripts)

**Direct Overlaps with create-revealui:**

| Existing Script | create-revealui Equivalent | Overlap % |
|----------------|---------------------------|-----------|
| `environment.ts` (218 lines) | `src/generators/env-file.ts` | **90%** |
| `database.ts` | `src/installers/database.ts` | **85%** |
| `postinstall.ts` | `src/installers/dependencies.ts` | **70%** |

**Key Features in Existing Scripts:**
- Interactive prompts for credentials (environment.ts:42-168)
- Validation with error messages
- Secret generation (REVEALUI_SECRET)
- Multi-provider support (Neon, Supabase, Local)
- Integration with @revealui/config

#### 3. CLI Infrastructure

**Existing CLI Base:** `/scripts/cli/_base.ts`
- Commander.js wrapper
- Shared logging utilities
- Error handling patterns

**create-revealui Implementation:**
- Reimplements CLI base
- Uses same Commander.js
- Duplicates logger patterns

#### 4. Shared Utilities (`/scripts/lib/`)

```
scripts/lib/
├── logger.ts (192 lines)          # Comprehensive logging
├── exec.ts                        # Command execution
├── paths.ts                       # Path utilities
├── validation.ts                  # Validation helpers
└── ...
```

**create-revealui Utilities:**
- `src/utils/logger.ts` - **Simplified reimplementation**
- `src/utils/git.ts` - **New utility**

---

## Overlap Analysis

### 🔴 HIGH PRIORITY OVERLAPS (Must Address)

#### 1. Environment File Generation

**Existing:** `scripts/setup/environment.ts` (218 lines)
```typescript
// Features:
- Interactive prompts with inquirer
- Reads .env.template
- Validates required variables
- Generates secure secrets
- Multi-provider support
- Integration with @revealui/config
```

**create-revealui:** `src/generators/env-file.ts` (105 lines)
```typescript
// Features:
- Hardcoded template
- Limited validation
- Basic secret generation
- No config integration
```

**Recommendation:**
- ✅ **Reuse** `scripts/setup/environment.ts`
- ✅ **Extend** with create-revealui prompts
- ✅ **Export** as importable module

---

#### 2. Database Initialization

**Existing:** `scripts/setup/database.ts`
```typescript
// Features:
- Connection testing
- Table initialization
- Migration execution
- Multi-provider support
- Comprehensive error handling
```

**create-revealui:** `src/installers/database.ts` (28 lines)
```typescript
// Features:
- Basic pnpm script execution
- Limited error handling
- No connection validation
```

**Recommendation:**
- ✅ **Reuse** existing database setup
- ✅ **Import** from scripts/setup/database.ts
- ⚠️ **Consider** extracting to @revealui/setup package

---

#### 3. Logger Utilities

**Existing:** `scripts/lib/logger.ts` (192 lines)
```typescript
// Features:
- Log levels (debug, info, warn, error)
- Color support detection
- Timestamps
- Tables, progress bars
- Header formatting
```

**create-revealui:** `src/utils/logger.ts` (39 lines)
```typescript
// Features:
- Basic info, success, warn, error
- Chalk colors
- Simplified API
```

**Recommendation:**
- ✅ **Reuse** `scripts/lib/logger.ts`
- ✅ **Create** lightweight wrapper if needed
- ❌ **Remove** duplicate implementation

---

### 🟡 MEDIUM PRIORITY OVERLAPS (Should Address)

#### 4. Configuration Validation

**Existing:** `@revealui/config` package
- Zod schemas for all env vars
- Runtime validation
- Type-safe access
- Multi-file loading

**create-revealui:** `src/validators/credentials.ts`
- Basic format validation
- No schema integration
- No type safety

**Recommendation:**
- ✅ **Import** @revealui/config for validation
- ✅ **Use** existing schemas
- ✅ **Validate** generated .env files

---

#### 5. CLI Base Infrastructure

**Existing:** `scripts/cli/_base.ts`
- Commander.js abstraction
- Consistent error handling
- Shared patterns

**create-revealui:** `src/cli.ts`
- Reimplements Commander patterns
- Custom error handling

**Recommendation:**
- 🤔 **Consider** extracting to @revealui/cli-base package
- ✅ **Share** between all CLI tools

---

### 🟢 LOW PRIORITY OVERLAPS (Nice to Have)

#### 6. Orchestration Engine

**Existing:** `scripts/orchestration/engine.ts`
- State machine for workflows
- Step-by-step execution
- Progress tracking

**create-revealui:** Sequential execution in `src/index.ts`

**Recommendation:**
- 🤔 **Future** - Use orchestration for complex flows
- ⏸️ **Not urgent** for MVP

---

## Proposed Architecture

### Option A: Leverage Existing Infrastructure (RECOMMENDED)

```
create-revealui (Orchestrator)
├─ Reuse: scripts/setup/environment.ts
├─ Reuse: scripts/setup/database.ts
├─ Reuse: scripts/lib/logger.ts
├─ Reuse: @revealui/config (validation)
├─ New: src/prompts/* (CLI-specific UX)
├─ New: src/generators/devcontainer.ts
├─ New: src/generators/devbox.ts
└─ New: src/generators/readme.ts
```

**Benefits:**
- ✅ Reduces duplication (eliminate ~300 lines)
- ✅ Consistent behavior with existing tools
- ✅ Leverages battle-tested code
- ✅ Single source of truth for setup logic
- ✅ Easier maintenance

**Challenges:**
- ⚠️ Requires refactoring existing scripts to be importable
- ⚠️ May need to extract scripts/lib/* to package

---

### Option B: Create Shared Setup Package (FUTURE)

```
@revealui/setup (New Package)
├─ src/environment/ (from scripts/setup/environment.ts)
├─ src/database/ (from scripts/setup/database.ts)
├─ src/utils/ (from scripts/lib/*)
└─ src/validators/ (from @revealui/config + create-revealui)

create-revealui
├─ Import: @revealui/setup
├─ Add: CLI-specific prompts
└─ Add: Generator templates
```

**Benefits:**
- ✅ Clean package boundaries
- ✅ Reusable across multiple CLI tools
- ✅ Better encapsulation
- ✅ Publishable independently

**Challenges:**
- ⚠️ More upfront architecture work
- ⚠️ Migration effort for existing scripts

---

### Option C: Current Approach (NOT RECOMMENDED)

Keep create-revealui separate with duplicated logic.

**Why Not Recommended:**
- ❌ Maintenance burden (fix bugs in 2 places)
- ❌ Inconsistent behavior between tools
- ❌ Violates DRY principle
- ❌ Larger bundle size

---

## Implementation Status

### ✅ Completed (Tasks 1-6)

#### Task 1: create-revealui Package Structure
**Status:** Complete
**Files Created:**
- `packages/create-revealui/package.json`
- `packages/create-revealui/tsconfig.json`
- `packages/create-revealui/tsup.config.ts`
- `packages/create-revealui/bin/create-revealui.js`

**Issues Found:**
- ⚠️ Package isolated - should import from existing packages

---

#### Task 2: Core CLI Implementation
**Status:** Complete
**Files Created:**
- `src/index.ts` - Main orchestrator (117 lines)
- `src/cli.ts` - Commander definition (32 lines)
- `src/prompts/project.ts` (46 lines)
- `src/prompts/database.ts` (68 lines)
- `src/prompts/storage.ts` (89 lines)
- `src/prompts/payments.ts` (67 lines)
- `src/prompts/devenv.ts` (21 lines)
- `src/validators/node-version.ts` (24 lines)
- `src/validators/credentials.ts` (70 lines)
- `src/utils/logger.ts` (39 lines) ⚠️ DUPLICATE
- `src/utils/git.ts` (40 lines)

**Issues Found:**
- ⚠️ `logger.ts` duplicates `scripts/lib/logger.ts`
- ⚠️ Prompts duplicate `scripts/setup/environment.ts` patterns
- ⚠️ No integration with @revealui/config

---

#### Task 3: Environment Generators
**Status:** Complete
**Files Created:**
- `src/generators/env-file.ts` (105 lines) ⚠️ OVERLAPS
- `src/generators/devcontainer.ts` (150 lines)
- `src/generators/devbox.ts` (37 lines)
- `src/generators/readme.ts` (88 lines)

**Issues Found:**
- 🔴 **HIGH:** `env-file.ts` reimplements `scripts/setup/environment.ts`
- ✅ **GOOD:** devcontainer.ts is new functionality
- ✅ **GOOD:** devbox.ts is new functionality

---

#### Task 4: Installation Workflows
**Status:** Complete
**Files Created:**
- `src/installers/dependencies.ts` (46 lines) ⚠️ OVERLAPS
- `src/installers/database.ts` (28 lines) ⚠️ OVERLAPS
- `src/installers/seed.ts` (29 lines)

**Issues Found:**
- 🔴 **HIGH:** `database.ts` reimplements `scripts/setup/database.ts`
- ⚠️ `dependencies.ts` overlaps with postinstall script

---

#### Task 5: Dev Container Configuration
**Status:** Complete
**Files Created:**
- `.devcontainer/devcontainer.json` (67 lines)
- `.devcontainer/docker-compose.yml` (31 lines)
- `.devcontainer/Dockerfile` (16 lines)
- `.devcontainer/README.md` (168 lines)

**Issues Found:**
- ✅ **GOOD:** New functionality, no overlaps
- ✅ **GOOD:** Well-documented

---

#### Task 6: Devbox Configuration
**Status:** Complete
**Files Created:**
- `devbox.json` (42 lines)
- `.envrc` (updated with Devbox integration)
- `docs/guides/DEVBOX_SETUP.md` (431 lines)

**Issues Found:**
- ✅ **GOOD:** New functionality, no overlaps
- ✅ **GOOD:** Comprehensive documentation

---

### ⏸️ Pending (Tasks 7-22)

Tasks 7-9: Testing and publishing (blocked pending architecture decision)
Tasks 10-13: Nix Server POC
Tasks 14-21: RevealUI Cloud
Tasks 22: Documentation updates

---

## Recommendations

### 🎯 Immediate Actions (Before Proceeding)

#### 1. Refactor create-revealui to Leverage Existing Code

**Priority: HIGH**

**Steps:**
1. **Extract Setup Scripts to Importable Modules**
   ```typescript
   // scripts/setup/environment.ts
   export { setupEnvironment, generateEnvFile } from './internal'
   ```

2. **Update create-revealui to Import**
   ```typescript
   // packages/create-revealui/src/installers/environment.ts
   import { generateEnvFile } from '../../../scripts/setup/environment'
   ```

3. **Remove Duplicate Code**
   - Delete `src/generators/env-file.ts`
   - Delete `src/installers/database.ts` implementation
   - Delete `src/utils/logger.ts`

4. **Add Dependencies**
   ```json
   // packages/create-revealui/package.json
   {
     "dependencies": {
       "@revealui/config": "workspace:*"
     }
   }
   ```

**Effort:** 2-3 days
**Impact:** Eliminates ~300 lines of duplicate code
**Risk:** Low (improves consistency)

---

#### 2. Validate with @revealui/config

**Priority: HIGH**

**Changes:**
```typescript
// src/generators/env-file.ts (if kept)
import { config } from '@revealui/config'
import { envSchema } from '@revealui/config/schema'

export async function generateEnvFile(...) {
  // Generate file
  await fs.writeFile(envPath, content)

  // Validate with existing schema
  const validation = envSchema.safeParse(process.env)
  if (!validation.success) {
    logger.error('Generated env file is invalid')
    // Show errors
  }
}
```

**Effort:** 1 day
**Impact:** Ensures generated files are valid
**Risk:** Low

---

#### 3. Create @revealui/cli-utils Package (Optional, Future)

**Priority: MEDIUM (Future Enhancement)**

**Structure:**
```
packages/cli-utils/
├── src/
│   ├── logger.ts (from scripts/lib/logger.ts)
│   ├── exec.ts (from scripts/lib/exec.ts)
│   ├── prompts.ts (shared prompt utilities)
│   └── base-cli.ts (from scripts/cli/_base.ts)
```

**Benefits:**
- Shared across create-revealui, scripts/cli/*, future tools
- Single logger implementation
- Consistent UX

**Effort:** 3-5 days
**Impact:** Long-term maintainability
**Risk:** Low (enhancement, not critical)

---

### 🎯 Architecture Decision Required

**Question:** How should we structure setup infrastructure?

**Options:**

| Option | Complexity | Timeline | Benefits |
|--------|------------|----------|----------|
| **A: Import from scripts/** | Low | 2-3 days | Quick, minimal changes |
| **B: Extract to @revealui/setup** | Medium | 1 week | Clean boundaries, reusable |
| **C: Keep separate** | Low | 0 days | No changes, but ongoing duplication |

**Recommendation:** **Start with Option A, migrate to Option B later**

**Rationale:**
- Get working solution quickly
- Validate approach with real usage
- Refactor to package when patterns are proven

---

### 🎯 Testing Strategy

Before publishing create-revealui:

1. **Unit Tests**
   - Test each generator independently
   - Mock file system operations
   - Validate generated content

2. **Integration Tests**
   - Create actual project
   - Run pnpm install
   - Verify database migrations work
   - Test Dev Container builds
   - Test Devbox shell activation

3. **E2E Tests**
   - Full workflow from CLI to running app
   - Test with different providers (Neon, Supabase, Local)
   - Verify all templates work

**Effort:** 3-5 days
**Blocked By:** Architecture refactoring

---

## Migration Path

### Phase 1: Refactoring (Week 1)

**Goal:** Eliminate duplication, leverage existing code

```
Day 1-2: Extract scripts/setup/* to importable modules
Day 3-4: Update create-revealui to import
Day 4-5: Remove duplicate code, add tests
```

**Deliverables:**
- ✅ create-revealui uses existing setup scripts
- ✅ No duplicate logger implementations
- ✅ Validation via @revealui/config

---

### Phase 2: Testing & Publishing (Week 2)

**Goal:** Validate and release create-revealui

```
Day 1-2: Unit tests for all components
Day 3-4: Integration tests (create projects)
Day 5: E2E tests, documentation updates
```

**Deliverables:**
- ✅ Comprehensive test suite
- ✅ Updated main README
- ✅ Published to npm

---

### Phase 3: Nix Server POC (Weeks 3-5)

**Goal:** Validate infrastructure approach

(Original Initiative 3 timeline)

---

### Phase 4: Cloud Platform (Months 3+)

**Goal:** Build RevealUI Cloud SaaS

(Original Initiative 2 timeline)

---

## Open Questions

### 🤔 Architecture Questions

1. **Should we create @revealui/setup package or import from scripts/?**
   - **Recommendation:** Start with imports, package later
   - **Blocker:** None, can decide now

2. **Should create-revealui be a workspace package or standalone?**
   - **Current:** Workspace package
   - **Future:** Could be standalone with published dependencies
   - **Blocker:** None

3. **How to handle template projects?**
   - **Option A:** Copy from examples/ directory
   - **Option B:** Embed templates in create-revealui package
   - **Option C:** Download from GitHub on demand
   - **Recommendation:** Option A for now (simplest)

---

### 🤔 Implementation Questions

4. **Should we support automatic database provisioning?**
   - **Neon:** API available, could auto-create databases
   - **Supabase:** API available, could auto-create projects
   - **Recommendation:** Manual for MVP, automated in Cloud version

5. **How to handle secrets in Dev Container/Codespaces?**
   - **Current:** .env.development.local (not committed)
   - **Codespaces:** Use repository/organization secrets
   - **Recommendation:** Document both approaches

6. **Should Devbox setup include PostgreSQL service?**
   - **Current:** Package installed, manual start
   - **Alternative:** Auto-start service in init_hook
   - **Recommendation:** Manual for control

---

### 🤔 Cloud Platform Questions

7. **What orchestration platform for RevealUI Cloud?**
   - **Plan:** Fly.io (primary), Railway (backup)
   - **Alternatives:** Render, Kubernetes
   - **Blocker:** None, Fly.io selected

8. **How to handle multi-tenancy?**
   - **Plan:** Isolated DB + Shared Container
   - **Alternative:** Full isolation (container per instance)
   - **Blocker:** Cost analysis needed

---

## Decision Log

### Decision 1: Dev Container Configuration ✅ APPROVED

**Date:** 2026-01-30
**Decision:** Add .devcontainer/ to project root
**Rationale:** No existing Dev Container support, new functionality
**Impact:** Low risk, high value for beginners
**Status:** Implemented

---

### Decision 2: Devbox Configuration ✅ APPROVED

**Date:** 2026-01-30
**Decision:** Add devbox.json to project root
**Rationale:** No existing Devbox support, complements Dev Containers
**Impact:** Low risk, high value for power users
**Status:** Implemented

---

### Decision 3: create-revealui Architecture ⏸️ PENDING REVIEW

**Date:** 2026-01-30
**Decision:** PENDING - Refactor to leverage existing infrastructure
**Rationale:** Significant overlap found with existing setup scripts
**Impact:** HIGH - Affects implementation approach
**Status:** **NEEDS APPROVAL**
**Reviewers:** @core-team

**Options:**
- [ ] **Option A:** Refactor to import from scripts/ (RECOMMENDED)
- [ ] **Option B:** Extract to @revealui/setup package
- [ ] **Option C:** Keep current implementation (NOT RECOMMENDED)

**Blocking:** Tasks 7-9 (Testing & Publishing)

---

### Decision 4: Template System ⏸️ PENDING

**Date:** 2026-01-30
**Decision:** PENDING - How to distribute templates
**Status:** **NEEDS DECISION**

**Options:**
- [ ] Copy from examples/ directory at runtime
- [ ] Embed in create-revealui package
- [ ] Download from GitHub

**Impact:** Medium - Affects package size and reliability

---

## Success Metrics

### Phase 1 (Hybrid DX) - Initiative 1

**Goal:** Reduce setup time from 30-45 minutes to <5 minutes

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Time to first `pnpm dev` | <5 min | Untested | ⏸️ |
| Setup success rate | >95% | Untested | ⏸️ |
| Lines of duplicate code | 0 | ~300 | 🔴 |
| Dev Container working | 100% | 100% | ✅ |
| Devbox working | 100% | 100% | ✅ |
| Documentation completeness | 100% | 80% | 🟡 |

---

### Phase 2 (Nix POC) - Initiative 3

**Goal:** Validate infrastructure approach

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Provision 3 instances | <90s | Not started | ⏸️ |
| Zero config drift | ✅ | Not started | ⏸️ |
| Rollback working | ✅ | Not started | ⏸️ |

---

### Phase 3 (Cloud) - Initiative 2

**Goal:** Production SaaS platform

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Instance provision time | <60s | Not started | ⏸️ |
| Uptime | >99.9% | Not started | ⏸️ |
| User satisfaction | >4.5/5 | Not started | ⏸️ |

---

## Next Steps

### Immediate (This Week)

1. **Review this RFC** - Core team decision on architecture
2. **Choose Option A or B** - Refactoring approach
3. **Create refactoring plan** - Detailed task breakdown

### Short-term (Weeks 2-3)

4. **Implement refactoring** - Eliminate duplication
5. **Add test suite** - Unit + integration tests
6. **Update documentation** - Main README, guides

### Medium-term (Weeks 4-6)

7. **Publish create-revealui** - npm release
8. **Start Nix POC** - Infrastructure validation
9. **Gather feedback** - User testing

### Long-term (Months 3+)

10. **Plan Cloud platform** - Architecture deep-dive
11. **Build MVP** - Core provisioning
12. **Beta launch** - Limited users

---

## Appendices

### Appendix A: File Overlap Comparison

| File | create-revealui | Existing | Overlap % |
|------|----------------|----------|-----------|
| Environment setup | src/generators/env-file.ts (105 lines) | scripts/setup/environment.ts (218 lines) | 90% |
| Database init | src/installers/database.ts (28 lines) | scripts/setup/database.ts | 85% |
| Logger | src/utils/logger.ts (39 lines) | scripts/lib/logger.ts (192 lines) | 70% |
| Prompts | src/prompts/* (291 lines) | scripts/setup/environment.ts (partial) | 60% |
| Validators | src/validators/* (94 lines) | @revealui/config + scripts | 50% |

**Total Duplicate Code:** ~300 lines
**Potential Reduction:** 60-80% via refactoring

---

### Appendix B: Dependencies Added

```json
{
  "packages/create-revealui/package.json": {
    "dependencies": {
      "chalk": "^5.6.2",
      "commander": "^13.0.0",
      "inquirer": "^12.0.0",
      "ora": "^8.0.1",
      "execa": "^9.0.0"
    }
  }
}
```

**Note:** No dependencies on existing RevealUI packages yet.
**Recommendation:** Add `@revealui/config` dependency.

---

### Appendix C: Files Created (30 total)

**create-revealui package (26 files):**
```
packages/create-revealui/
├── package.json, tsconfig.json, tsup.config.ts, README.md (4)
├── bin/create-revealui.js (1)
├── src/
│   ├── index.ts, cli.ts (2)
│   ├── prompts/ (5)
│   ├── generators/ (4)
│   ├── installers/ (3)
│   ├── validators/ (2)
│   └── utils/ (2)
└── templates/devcontainer/ (3)
```

**Dev Container (4 files):**
```
.devcontainer/
├── devcontainer.json
├── docker-compose.yml
├── Dockerfile
└── README.md
```

**Devbox (2 files + 1 updated):**
```
devbox.json
docs/guides/DEVBOX_SETUP.md
.envrc (updated)
```

---

## Review Checklist

**Before Approving This RFC:**

- [ ] Core team has reviewed architecture recommendations
- [ ] Decision made on refactoring approach (Option A vs B)
- [ ] Template distribution strategy decided
- [ ] Success metrics validated
- [ ] Timeline approved
- [ ] Resources allocated

**Reviewers:**
- [ ] @technical-lead
- [ ] @architecture-team
- [ ] @devops-lead

---

## Conclusion

This RFC proposes significant enhancements to RevealUI's development experience but identifies critical architectural overlaps that must be addressed. **The recommendation is to refactor create-revealui to leverage existing infrastructure before proceeding with testing and publishing.**

**Key Takeaway:** RevealUI already has excellent setup infrastructure. The opportunity is to create a unified, simplified CLI experience by **composing existing tools** rather than reimplementing functionality.

---

**RFC Status:** DRAFT - Awaiting Core Team Review
**Next Review Date:** TBD
**Contact:** Implementation Team

