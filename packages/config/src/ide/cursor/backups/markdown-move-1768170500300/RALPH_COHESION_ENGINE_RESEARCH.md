# Ralph Cohesion Engine Research

**Date**: January 2025  
**Purpose**: Research and design automated cohesion analysis and cleanup system  
**Goal**: Create Ralph-powered system that analyzes codebase cohesion AND automatically fixes issues

---

## Executive Summary

The **Ralph Cohesion Engine** is an automated system that:
1. **Analyzes** codebase cohesion issues (patterns, metrics, type safety)
2. **Generates** brutally honest assessment documents
3. **Fixes** issues automatically (type safety, imports, patterns)
4. **Iterates** using Ralph workflow for continuous improvement

**Key Capabilities**:
- Pattern detection (duplicate code, inconsistent imports)
- Metric generation (file counts, line numbers, percentages)
- Code extraction (file:line references with context)
- Assessment generation (brutal honesty with real evidence)
- Automated cleanup (fixes, refactoring, standardization)
- Iterative improvement (Ralph workflow for gradual fixes)

---

## Current Ralph Workflow Analysis

### Existing Ralph Capabilities

**What Ralph Does**:
- Manual iterative workflow system
- State management (iteration tracking)
- Completion detection (marker files)
- Workflow cleanup

**What Ralph Doesn't Do**:
- No automated code analysis
- No pattern detection
- No automated fixes
- No assessment generation

**Ralph Architecture**:
```
scripts/ralph/
├── start.ts      # Start workflow
├── continue.ts   # Continue iteration
├── status.ts     # Check status
├── cancel.ts     # Cancel workflow
├── utils.ts      # State management
└── types.ts      # Type definitions
```

**State Management**:
- YAML frontmatter in `.cursor/ralph-loop.local.md`
- Prompt stored in `.cursor/ralph-prompt.md`
- Completion marker: `.cursor/ralph-complete.marker`
- Simple iteration tracking

---

## Ralph Cohesion Engine Design

### Architecture

```
scripts/cohesion/
├── analyze.ts        # Analyze codebase
├── assess.ts         # Generate assessment
├── fix.ts            # Apply automated fixes
├── utils/
│   ├── patterns.ts   # Pattern detection
│   ├── metrics.ts    # Metric generation
│   ├── extraction.ts # Code extraction
│   └── fixes.ts      # Fix generation
├── types.ts          # Type definitions
└── ralph.ts          # Ralph integration
```

### Phase 1: Analysis Engine

**Purpose**: Detect cohesion issues automatically

**Capabilities**:
1. **Pattern Detection**
   - Duplicate imports (same pattern across files)
   - Inconsistent patterns (variations of same pattern)
   - Type assertion usage (`as any`, `as unknown`)
   - Workaround detection (comments mentioning workarounds)

2. **Metric Generation**
   - File counts (how many files have pattern X)
   - Line counts (total instances)
   - Percentage calculations
   - Distribution analysis

3. **Code Extraction**
   - File:line references
   - Code context (surrounding lines)
   - Pattern matching
   - AST-based analysis

**Implementation Strategy**:
- Use TypeScript compiler API for AST analysis
- Use ripgrep (via grep tool) for pattern matching
- Use file system APIs for file traversal
- Generate structured data (JSON) for assessment

**Example Output**:
```typescript
{
  "pattern": "getRevealUI({ config })",
  "instances": [
    {
      "file": "apps/cms/src/app/(backend)/api/[...slug]/route.ts",
      "line": 16,
      "code": "revealInstance = await getRevealUI({ config });",
      "context": {
        "before": "async function getReveal() {",
        "after": "return revealInstance;"
      }
    },
    // ... more instances
  ],
  "total": 16,
  "variations": 3,
  "severity": "HIGH"
}
```

---

### Phase 2: Assessment Generation

**Purpose**: Generate brutally honest assessment documents

**Capabilities**:
1. **Template-Based Generation**
   - Brutal assessment template
   - Severity ratings (CRITICAL, HIGH, MEDIUM, LOW)
   - Grade calculation (D+, C-, etc.)
   - Concrete metrics insertion

2. **Evidence Integration**
   - File:line references with code blocks
   - Real code examples
   - Contextual information
   - Impact statements

3. **Brutal Honesty**
   - Direct language (no sugarcoating)
   - Real problems (not generic issues)
   - Concrete evidence (file:line references)
   - Honest grades (D+, C-, etc.)

**Implementation Strategy**:
- Use analysis output (JSON) as input
- Template engine (handlebars or simple string replacement)
- Markdown generation
- Code block formatting

**Example Template**:
```markdown
## Issue: {title}

**Severity: {severity}**  
**Impact: {impact}**

**Evidence**:
{evidence_list}

**Problem**: {problem_statement}

**Real-World Impact**: {impact_statement}
```

---

### Phase 3: Automated Cleanup

**Purpose**: Fix issues automatically

**Capabilities**:
1. **Type Safety Fixes**
   - Remove `as any` assertions
   - Fix type definitions
   - Align types properly
   - Remove workarounds

2. **Import Standardization**
   - Convert to consistent pattern (`@revealui/` everywhere)
   - Remove workarounds (direct path imports)
   - Update Vite/Next.js configs
   - Migration tracking

3. **Pattern Extraction**
   - Extract duplicate patterns into utilities
   - Create shared functions
   - Update call sites
   - Generate integration utilities

4. **Configuration Fixes**
   - Fix config type safety
   - Remove type assertions
   - Fix TypeScript resolution
   - Remove workarounds

**Implementation Strategy**:
- Use TypeScript compiler API for code transformation
- Use AST manipulation for safe refactoring
- Generate code diffs (show changes)
- Safety checks (don't break code)

**Example Fix**:
```typescript
// Before
const revealui = await getRevealUI({ config: config as any })

// After (automated fix)
const revealui = await getRevealUI({ config })
```

**Safety Mechanisms**:
- Generate diffs before applying
- Run type checking after fixes
- Create backup before changes
- Incremental application (one fix at a time)

---

### Phase 4: Ralph Integration

**Purpose**: Use Ralph workflow for iterative improvement

**Capabilities**:
1. **Iterative Analysis**
   - Analyze codebase
   - Generate assessment
   - Apply fixes incrementally
   - Re-analyze after fixes
   - Track progress

2. **Workflow Management**
   - Start cohesion analysis workflow
   - Continue iteration (apply next fix)
   - Track fixes applied
   - Completion detection

3. **Progress Tracking**
   - Metrics before/after
   - Fixes applied count
   - Remaining issues
   - Improvement percentage

**Implementation Strategy**:
- Extend Ralph workflow system
- Add cohesion-specific state
- Integration with analyze/assess/fix tools
- Progress reporting

**Workflow Example**:
```bash
# Start cohesion analysis
pnpm cohesion:analyze

# Review assessment
cat DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md

# Start Ralph workflow for fixes
pnpm ralph:start "Fix cohesion issues" --completion-promise "DONE"

# Apply first fix (automated)
pnpm cohesion:fix --fix-type="type-assertions"

# Continue iteration
pnpm ralph:continue

# Apply next fix
pnpm cohesion:fix --fix-type="imports"

# ... repeat until complete

# Mark complete
echo "DONE" > .cursor/ralph-complete.marker
pnpm ralph:continue
```

---

## Cleanup Operations

### 1. Type Assertion Removal

**Detection**:
- Find `as any` patterns
- Find `as unknown` patterns
- Find type assertions in config files
- Find forced type assertions

**Fix Strategy**:
1. Analyze type mismatch
2. Fix type definitions
3. Remove type assertion
4. Verify type checking passes

**Example**:
```typescript
// Before
fields: ({ defaultFields }: { defaultFields: any[] }) => {

// After
fields: ({ defaultFields }: { defaultFields: Field[] }) => {
```

**Safety**:
- Check type compatibility first
- Fix types before removing assertions
- Run type checking after fix
- Rollback if type errors

---

### 2. Import Standardization

**Detection**:
- Find `revealui/` imports (unscoped)
- Find direct path imports (workarounds)
- Find inconsistent scoped imports

**Fix Strategy**:
1. Convert to `@revealui/` scoped pattern
2. Update package.json exports if needed
3. Update Vite/Next.js configs
4. Update import statements

**Example**:
```typescript
// Before
import { Container } from 'revealui/ui/shells'

// After
import { Container } from '@revealui/ui/shells'
```

**Safety**:
- Verify package exports exist
- Check build after changes
- Update configs if needed
- Test imports work

---

### 3. Pattern Extraction

**Detection**:
- Find duplicate code patterns
- Find repeated instance management
- Find duplicate utility functions

**Fix Strategy**:
1. Extract pattern to shared utility
2. Create utility file
3. Update all call sites
4. Remove duplicate code

**Example**:
```typescript
// Before (duplicated in 16 files)
async function getReveal() {
  if (!revealInstance) {
    revealInstance = await getRevealUI({ config });
  }
  return revealInstance;
}

// After (shared utility)
import { getRevealUIInstance } from '@revealui/integration/nextjs'

const revealui = await getRevealUIInstance()
```

**Safety**:
- Verify utility works correctly
- Test all call sites
- Update types if needed
- Rollback if issues

---

### 4. Configuration Type Fixes

**Detection**:
- Find type assertions in config
- Find config workarounds
- Find TypeScript resolution issues

**Fix Strategy**:
1. Fix type definitions in `@revealui/config`
2. Remove type assertions
3. Fix TypeScript resolution
4. Remove workarounds

**Example**:
```typescript
// Before
import { detectEnvironment } from '../../packages/config/src/loader.js'

// After
import { detectEnvironment } from '@revealui/config'
```

**Safety**:
- Fix types first
- Fix resolution issues
- Test config loading
- Verify no type errors

---

## Implementation Plan

### Phase 1: Analysis Engine (Foundation)

**Priority**: HIGH  
**Effort**: Medium

1. **Pattern Detection**
   - AST-based pattern matching
   - Grep-based pattern search
   - Duplicate detection
   - Variation detection

2. **Metric Generation**
   - File counting
   - Instance counting
   - Percentage calculation
   - Distribution analysis

3. **Code Extraction**
   - File:line references
   - Code context extraction
   - Pattern matching
   - AST traversal

**Deliverables**:
- `scripts/cohesion/utils/patterns.ts`
- `scripts/cohesion/utils/metrics.ts`
- `scripts/cohesion/utils/extraction.ts`
- `scripts/cohesion/analyze.ts`

---

### Phase 2: Assessment Generation

**Priority**: HIGH  
**Effort**: Medium

1. **Template System**
   - Brutal assessment template
   - Severity rating logic
   - Grade calculation
   - Metric insertion

2. **Evidence Integration**
   - Code block generation
   - File:line references
   - Context inclusion
   - Impact statements

3. **Document Generation**
   - Markdown generation
   - Code formatting
   - Structure generation
   - Output file creation

**Deliverables**:
- `scripts/cohesion/utils/templates.ts`
- `scripts/cohesion/assess.ts`
- Assessment template
- Generated assessment document

---

### Phase 3: Automated Cleanup (Core)

**Priority**: CRITICAL  
**Effort**: High

1. **Type Safety Fixes**
   - Type assertion removal
   - Type definition fixes
   - Type alignment
   - Workaround removal

2. **Import Standardization**
   - Import pattern conversion
   - Config updates
   - Package.json updates
   - Import statement fixes

3. **Pattern Extraction**
   - Duplicate code extraction
   - Utility generation
   - Call site updates
   - Code removal

4. **Configuration Fixes**
   - Config type fixes
   - Resolution fixes
   - Workaround removal
   - Type alignment

**Deliverables**:
- `scripts/cohesion/utils/fixes.ts`
- `scripts/cohesion/fix.ts`
- Fix strategies
- Safety mechanisms

---

### Phase 4: Ralph Integration

**Priority**: MEDIUM  
**Effort**: Low

1. **Workflow Integration**
   - Ralph workflow extension
   - Cohesion-specific state
   - Iteration tracking
   - Progress reporting

2. **Command Integration**
   - `pnpm cohesion:analyze`
   - `pnpm cohesion:assess`
   - `pnpm cohesion:fix`
   - `pnpm cohesion:workflow`

**Deliverables**:
- `scripts/cohesion/ralph.ts`
- Workflow integration
- Command scripts
- Progress tracking

---

## Technical Considerations

### Code Transformation

**Tools**:
- TypeScript Compiler API (AST manipulation)
- jscodeshift (code transformations)
- Prettier (code formatting)
- Biome (code formatting/linting)

**Approach**:
- AST-based transformations (safe, accurate)
- Incremental application (one fix at a time)
- Safety checks (don't break code)
- Diff generation (show changes)

**Safety**:
- Type checking after fixes
- Build verification
- Test execution
- Rollback capability

---

### Pattern Detection

**Methods**:
- AST matching (structural patterns)
- Regex matching (text patterns)
- Grep search (file-level patterns)
- Semantic analysis (meaning-based patterns)

**Challenges**:
- Pattern variations (same concept, different syntax)
- Context sensitivity (when is pattern a problem?)
- False positives (patterns that aren't issues)
- Edge cases (corner cases)

**Solutions**:
- Multiple detection methods (combine approaches)
- Configuration (tune detection)
- Manual review (human verification)
- Iterative improvement (refine over time)

---

### Fix Safety

**Mechanisms**:
- Type checking (verify types after fix)
- Build verification (verify builds after fix)
- Test execution (run tests after fix)
- Diff review (show changes before applying)

**Rollback**:
- Git-based rollback (commit before fixes)
- Backup files (backup before changes)
- Incremental application (one fix at a time)
- Manual review (human approval)

**Risk Mitigation**:
- Conservative fixes (only fix obvious issues)
- Configuration (enable/disable fix types)
- Dry-run mode (show what would change)
- Manual approval (human review before applying)

---

## Success Metrics

### Analysis Quality

1. **Pattern Detection**: 90%+ accuracy
2. **Metric Accuracy**: 100% accuracy (exact counts)
3. **Code Extraction**: All relevant code extracted
4. **Assessment Quality**: Grade A brutal honesty

### Fix Quality

1. **Fix Accuracy**: 95%+ fixes work correctly
2. **Type Safety**: 100% type checking passes
3. **Build Success**: 100% builds succeed
4. **Test Pass Rate**: 100% tests pass

### Developer Experience

1. **Time Saved**: 50%+ reduction in manual work
2. **Error Reduction**: 30%+ fewer errors
3. **Consistency**: 100% consistency after fixes
4. **Developer Satisfaction**: Positive feedback

---

## Risks & Mitigations

### Risk 1: Breaking Code

**Risk**: Automated fixes may break code.

**Mitigation**:
- Type checking after fixes
- Build verification
- Test execution
- Incremental application
- Rollback capability

---

### Risk 2: False Positives

**Risk**: Pattern detection may flag non-issues.

**Mitigation**:
- Conservative detection (only obvious issues)
- Configuration (tune detection)
- Manual review (human verification)
- Iterative improvement (refine over time)

---

### Risk 3: Over-Engineering

**Risk**: System may be too complex.

**Mitigation**:
- Start simple (MVP first)
- Incremental development (add features gradually)
- Focus on value (solve real problems)
- Keep it maintainable (simple architecture)

---

## Next Steps

1. **Research**: Review existing tools (jscodeshift, TypeScript API)
2. **Design**: Finalize architecture and API
3. **Prototype**: Build MVP (analysis + assessment only)
4. **Iterate**: Add fixes incrementally
5. **Integrate**: Connect to Ralph workflow
6. **Test**: Test on real codebase
7. **Refine**: Improve based on results

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Research Phase
