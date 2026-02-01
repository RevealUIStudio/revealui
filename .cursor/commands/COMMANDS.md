# Cursor Commands Reference

This document consolidates all available Cursor commands for the RevealUI project.

---

## Table of Contents

1. [Smart Development Analyzer](#smart-development-analyzer)
2. [Code Generation](#code-generation)
3. [Development Template](#development-template)
4. [Development Prompt](#development-prompt)
5. [Code Review](#code-review)
6. [Debug Issue](#debug-issue)
7. [Test Implementation](#test-implementation)
8. [Analyze Task](#analyze-task)

---

## Smart Development Analyzer

AI-powered development task analysis that automatically creates comprehensive implementation plans from natural language descriptions.

### How to Use
1. Type `/smart-dev` in Cursor chat
2. Provide a natural language description of your development task
3. The AI will analyze and generate a complete structured plan

### What It Does
- **Task Classification**: Identifies task type (bug-fix, feature, refactor, test, etc.)
- **Complexity Assessment**: Evaluates effort level and priority
- **Requirement Extraction**: Pulls specific needs from your description
- **File Identification**: Suggests relevant source files to modify
- **Technical Planning**: Creates implementation approach and constraints
- **Risk Analysis**: Identifies potential blockers and issues
- **Success Criteria**: Defines measurable completion standards
- **Implementation Phases**: Provides step-by-step execution plan

### Validation Requirements
**CRITICAL**: All changes must pass validation before implementation

#### Pre-Change Validation (Required)
- **Type Checking**: Run `pnpm typecheck:all` before any file modifications
- **Linting**: Run `pnpm lint` to identify existing code quality issues
- **Test Baseline**: Run `pnpm test` to establish current test status

#### Per-Change Validation (Mandatory)
- **After Each Change**: Must pass all three validations before proceeding:
  1. **Type Checking**: `pnpm typecheck:all` - No TypeScript errors
  2. **Linting**: `pnpm lint` - No linting violations
  3. **Testing**: `pnpm test` - All tests passing (including new tests)

#### Implementation Blocking
- **❌ Cannot proceed** if any validation fails
- **🔄 Must fix issues** before continuing to next change
- **📋 Document pre-existing issues** separately from new work
- **🚫 No exceptions** - All validations must pass for each change

### RevealUI Context
Automatically includes:
- ESM-only imports, named exports preferred
- No GraphQL (REST + RPC only)
- TypeScript strict mode
- Async/await over promises
- JSDoc comments for public APIs

### Example Usage

**Input:**
```
Users getting 500 errors when logging in with emails containing @test+tag@gmail.com. API crashes in auth validation step.
```

**AI Generates:**
```
🎯 Task Classification
Type: bug-fix
Complexity: small-task
Priority: high

📋 Understanding
Core Problem: Authentication API crashes when validating emails with special characters like Gmail aliases
Why It Matters: Blocks user registration and login for users with Gmail aliases (+ symbols)
Current State: API throws 500 errors instead of handling special characters properly

🎯 Solution Requirements
Must Do:
- [ ] Update email validation to handle RFC 5322 compliant email addresses
- [ ] Add test cases for emails with + symbols and other special characters
- [ ] Ensure existing email validation continues to work

🔧 Technical Approach
Files to Modify: packages/auth/src/server/auth.ts, packages/auth/src/__tests__/integration/auth-flow.test.ts
Key Changes: Update email validation regex/function to handle Gmail aliases and special characters
Testing Strategy: Add integration tests for various email formats, ensure no regression

🚫 Constraints & Rules
RevealUI Standards:
- [x] ESM only (no CommonJS)
- [x] Named exports preferred
- [x] No GraphQL (REST + RPC only)
- [x] TypeScript strict mode

**Validation Requirements (MANDATORY):**
- [ ] Pre-change: Run `pnpm typecheck:all` and `pnpm lint` to identify pre-existing issues
- [ ] Post-change: Run `pnpm typecheck:all`, `pnpm lint`, `pnpm test` after each modification
- [ ] Block implementation if any validation fails - fix issues before proceeding

✅ Success Validation
Definition of Done:
- [ ] Emails with + symbols work for registration and login
- [ ] All existing auth tests still pass
- [ ] New test cases added for special character emails
- [ ] All validations pass: TypeScript ✅, Linting ✅, Testing ✅

🔄 Implementation Plan
Phase 1: Update email validation function in auth.ts
       → Validation: `pnpm typecheck:all && pnpm lint && pnpm test`
Phase 2: Add comprehensive test cases
       → Validation: `pnpm typecheck:all && pnpm lint && pnpm test`
Phase 3: Test and verify no regressions
       → Final Validation: `pnpm typecheck:all && pnpm lint && pnpm test`

⚠️ Risks & Considerations
- Overly permissive validation could allow invalid emails
- Performance impact of more complex regex
- Validation failures may indicate pre-existing issues requiring separate fixes
```

### Benefits
- **Structured Planning**: Transforms vague task descriptions into actionable development plans
- **Comprehensive Analysis**: Considers technical, business, and risk factors
- **Documentation**: Saves analysis to `docs/analyses/` for future reference
- **Consistency**: Standardized approach across all development tasks
- **Time Savings**: Instant analysis instead of manual planning

### Integration
- **Analysis Storage**: Automatically saves to `docs/analyses/` with metadata
- **Code Generation**: Compatible with `/generate-code` for implementation
- **Team Workflow**: Standardized planning process across team members

### Tips for Best Results
- **Be Specific**: Include error messages, stack traces, user impact
- **Provide Context**: Mention affected features, user flows, business requirements
- **Include Examples**: Show problematic input/output if applicable
- **Mention Files**: If you know which files are involved, include them

---

## Code Generation

Transform `/smart-dev` analysis into actual code implementation. Generate working code, tests, and documentation based on approved development plans.

### How to Use

#### Default: Attach Analysis File
1. Open or attach a `/smart-dev` analysis file (like the documentation audit analysis currently open)
2. Run `/generate-code`
3. AI automatically reads the analysis and generates implementation guidance

**The command automatically detects attached/opened analysis files and processes them.**

#### Fallback: Manual Input
If no analysis file is attached/opened, the command provides guidance on how to use it properly.

### What It Does
- **Reads** attached `/smart-dev` analysis files automatically
- **Parses** requirements, constraints, and implementation plans
- **Generates** step-by-step implementation instructions
- **Provides** code examples and file structure guidance
- **Creates** testing strategies and validation approaches

### Default Behavior: Attached Analysis Files

**When you have an analysis file open/attached (like the documentation audit analysis):**

The command automatically:
1. **Detects** the attached analysis file
2. **Parses** the complete analysis content
3. **Extracts** task type, requirements, constraints, and success criteria
4. **Generates** specific implementation steps for that analysis
5. **Provides** code examples tailored to the specific task

**Example with your attached documentation audit:**
- Detects: Documentation audit (complex-effort)
- Extracts: 241+ files, false claims, cleanup requirements
- Generates: Automated scripts, consolidation plans, maintenance policies

### Fallback Behavior: No Attached File

**When no analysis file is detected:**

The command provides general guidance on:
- How to obtain analysis files from `/smart-dev`
- How to attach analysis files for processing
- General code generation patterns and best practices
- Framework-specific implementation guidance

### What `/generate-code` Produces

#### With Attached Analysis File (Default):
The command generates a complete implementation guide tailored to the specific analysis:

```
🎯 Implementation Plan for [Task Type]

📋 Analysis Summary
- Task: [extracted from analysis]
- Complexity: [extracted from analysis]
- Files: [extracted from analysis]

🔧 Implementation Steps
1. [Step-by-step instructions]
2. [Code examples]
3. [File structure]

🧪 Testing Strategy
- [Test approach]
- [Coverage requirements]

✅ Validation Criteria
- [Success metrics]
- [Verification steps]
```

#### With No Attached File (Fallback):
The command provides general implementation guidance:

```
🤖 No Analysis File Detected

To generate implementation code:

1. Run `/smart-dev` first to create an analysis
2. Attach/open the analysis file
3. Run `/generate-code` to get implementation guidance

📚 General Implementation Patterns:
- [Framework-specific patterns]
- [Code structure guidelines]
- [Testing approaches]
- [Documentation standards]
```

### What It Generates
- **Implementation Guidance**: Step-by-step instructions for code changes
- **Code Examples**: Actual code snippets and file structures
- **Scripts**: Ready-to-run implementation scripts
- **Testing Plans**: Comprehensive test coverage strategies
- **Validation Steps**: Success criteria and verification approaches

### Automatic Code Changes: Current Status

**Currently:** `/generate-code` provides detailed implementation guidance and scripts that you can run manually.

**Future Enhancement:** The system could be extended to automatically apply changes, but this requires careful safety controls.

#### Safe Automatic Implementation (Conceptual)

If automatic code changes were enabled, the workflow would be:

1. **Analysis Review** - Human approves the `/smart-dev` analysis
2. **Change Preview** - AI shows exactly what files/code will be modified
3. **Safety Confirmation** - Human confirms changes are safe
4. **Automatic Application** - AI applies the changes to files
5. **Validation** - Automatic testing and verification

#### Current Manual Process

The generated implementation includes executable scripts that you run manually:

```bash
# Generated script example
node scripts/audit-docs.ts    # Creates audit system
node scripts/verify-claims.ts # Verifies false claims
node scripts/consolidate-docs.ts # Creates cleanup plan
```

**Result:** Working implementation with full human oversight and control.

### Implementation Process

#### Validation Requirements (MANDATORY)
**All changes require validation success before proceeding**

##### Pre-Implementation Validation
- **Type Check First**: Run `pnpm typecheck:all` before any code generation
- **Lint Baseline**: Run `pnpm lint` to document existing issues
- **Test Status**: Run `pnpm test` to establish current test baseline

##### Per-Change Validation (Required)
**Must pass ALL validations after each change:**
1. **TypeScript**: `pnpm typecheck:all` - Zero errors allowed
2. **Linting**: `pnpm lint` - No violations permitted
3. **Testing**: `pnpm test` - All tests must pass

##### Validation Blocking Rules
- **❌ Block Implementation**: Cannot proceed if any validation fails
- **🔧 Fix First**: Resolve validation issues before continuing
- **📝 Document Issues**: Note pre-existing problems separately
- **🚫 No Skip**: Validations are mandatory for every change

#### Analysis Parsing
- Extracts requirements, constraints, and success criteria
- Identifies files to modify and creation patterns
- Validates analysis completeness and consistency
- Maps requirements to specific code changes

#### Code Generation Strategy
- **Pattern-Based**: Uses proven RevealUI patterns and conventions
- **Safety-First**: Generates code that integrates safely with existing codebase
- **Test-Driven**: Creates tests alongside implementation
- **Documentation**: Includes comprehensive code comments and docs

#### Quality Assurance
- **TypeScript Compliance**: All generated code passes strict mode
- **Import Validation**: Correct ESM imports and exports
- **Error Handling**: Comprehensive error boundaries and validation
- **Performance**: Efficient algorithms and resource usage
- **Validation Integration**: Includes validation commands in generated code

### RevealUI-Specific Generation

#### Framework Compliance
- **ESM Imports**: All imports use ES module syntax
- **Named Exports**: Preferred export pattern throughout
- **REST/RPC Only**: No GraphQL usage in generated code
- **TypeScript Strict**: Full type safety with no `any` types

#### Architecture Patterns
- **Component Structure**: Proper React component patterns
- **State Management**: Appropriate state handling approaches
- **API Integration**: Consistent API calling patterns
- **Error Boundaries**: Comprehensive error handling

#### Testing Standards
- **Test Frameworks**: Vitest for unit tests, React Testing Library for components
- **Coverage Goals**: 90%+ statement coverage, 80%+ branch coverage
- **Test Patterns**: Arrange-Act-Assert structure
- **Mock Strategy**: Proper mocking of external dependencies

### Example Generation

**From Analysis:**
```
🎯 Task Classification
Type: bug-fix
Complexity: small-task

🎯 Solution Requirements
Must Do:
- [ ] Update email validation to handle RFC 5322 compliant email addresses
- [ ] Add test cases for emails with + symbols and other special characters

🔧 Technical Approach
Files to Modify: packages/auth/src/server/auth.ts
```

**Generates Code:**
```bash
# Pre-change validation (MANDATORY)
pnpm typecheck:all  # Identify pre-existing TypeScript issues
pnpm lint          # Identify pre-existing linting issues
pnpm test          # Establish current test baseline
```

```typescript
// packages/auth/src/server/auth.ts
export function validateEmail(email: string): boolean {
  // RFC 5322 compliant email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// packages/auth/src/__tests__/integration/auth-flow.test.ts
describe('Email validation edge cases', () => {
  it('should accept Gmail aliases with +', () => {
    expect(validateEmail('test+tag@gmail.com')).toBe(true)
  })

  it('should accept emails with special characters in local part', () => {
    expect(validateEmail('user.name+tag@example.com')).toBe(true)
  })
})
```

```bash
# Post-change validation (MANDATORY - Must pass all)
pnpm typecheck:all  # Verify no TypeScript errors introduced
pnpm lint          # Verify no linting violations
pnpm test          # Verify all tests pass including new ones
```

### Safety & Control

#### Human Oversight Required
- **Analysis Review**: You must approve the analysis before generation
- **Code Review**: All generated code requires human review
- **Testing**: Generated tests must be validated
- **Integration**: Manual verification of integration points

#### Safe Generation
- **No File Deletion**: Never deletes existing files or code
- **Append-Only**: Adds new code without removing existing functionality
- **Backup Creation**: Preserves original state for rollback
- **Dry Run Mode**: Preview changes before applying

#### Error Handling
- **Validation First**: Validates analysis completeness before generation
- **Incremental Changes**: Applies changes incrementally with validation
- **Rollback Support**: Can revert changes if issues detected
- **Clear Feedback**: Provides detailed progress and error reporting

### Integration Workflow

#### Phase 1: Analysis (`/smart-dev`)
```
Input: "Users getting 500 errors when logging in with emails containing @test+tag@gmail.com"
Output: Comprehensive analysis saved to docs/analyses/
```

#### Phase 2: Attach Analysis File
```
Open/attach the analysis file (like docs/analyses/2024-01-27-*.md)
The /generate-code command will automatically detect and read it
```

#### Phase 3: Generation (`/generate-code`)
```
Input: Automatically reads attached analysis file
Output: Step-by-step implementation guidance with code examples
```

#### Phase 4: Implementation
```
Developer follows the generated guidance
Implements code according to the provided steps
Adds tests and documentation as specified
```

#### Phase 5: Validation
```
Run tests and verify functionality
Review implementation against success criteria
Commit changes when satisfied
```

### Advanced Features

#### Context-Aware Generation
- **Framework Knowledge**: Deep understanding of RevealUI patterns
- **Project Structure**: Aware of existing file organization
- **Dependency Management**: Proper import/export handling
- **Convention Compliance**: Follows established coding standards

#### Quality Metrics
- **Type Safety**: 100% TypeScript compliance
- **Test Coverage**: Comprehensive test generation
- **Performance**: Optimized algorithms and patterns
- **Maintainability**: Clean, readable, well-documented code

### Usage Examples

#### Bug Fix Generation
**Analysis:** Fix email validation crash
**Generates:** Updated validation function + comprehensive tests

#### Feature Implementation
**Analysis:** Add user profile avatar upload
**Generates:** Upload component + API integration + file handling + tests

#### Refactoring Task
**Analysis:** Extract reusable authentication logic
**Generates:** Utility functions + updated imports + test coverage

### Best Practices

#### Preparation
- **Complete Analysis**: Ensure `/smart-dev` analysis is thorough and approved
- **Clear Requirements**: Analysis should have specific, actionable requirements
- **File Planning**: Analysis should identify exact files to modify/create

#### Generation
- **Review First**: Always review generated code before committing
- **Test Execution**: Run generated tests and verify functionality
- **Integration Check**: Ensure new code integrates properly with existing codebase
- **Performance Validation**: Verify no performance regressions

#### Maintenance
- **Documentation**: Keep generation analysis for future reference
- **Version Control**: Commit generated code with clear commit messages
- **Team Review**: Have generated code reviewed by team members

---

## Development Template

Quick development task template for manual control.

### How to Use
Type `/dev` in Cursor chat for a simple development template.

### Template Structure

```
# 🎯 Development Task Template

**Type:** [bug fix | feature | refactor | test | other]
**Description:** [Brief 1-2 sentence summary]

**Files:** [list key files involved]
**Context:** [why this matters, current state]

**Requirements:**
- [ ] [Core requirement 1]
- [ ] [Core requirement 2]
- [ ] [Core requirement 3]

**Constraints:**
- ESM only (no CommonJS)
- Named exports preferred
- No GraphQL (REST + RPC only)
- TypeScript strict mode

**Success:**
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]

**Next:** [Immediate action or next phase]

**Notes:** [Risks, gotchas, or reminders]
```

### When to Use
- Simple tasks requiring manual control
- Quick fixes or small changes
- Tasks without complex planning needs
- When you want full control over implementation

---

## Development Prompt

Comprehensive development phase template with detailed guidance.

### Template Structure

```
# 🎯 DEVELOPMENT PHASE: [PHASE_NAME]
**Phase Description**: [Brief description of current development phase]

---

## 📋 TASK CONTEXT

### Project Overview
**Framework**: RevealUI (React 19 + Next.js 16 enterprise framework)
**Architecture**: Monorepo with pnpm workspaces
**Key Technologies**: TypeScript (strict), Tailwind CSS 4.0, Turbopack bundler
**Current Focus**: [Specific app/package/module being worked on]

### Current State
**Open Files**:
- [Primary file]: [cursor position, selection details]
- [Related files]: [list of other relevant files]

**Git Status**:
- [Current branch]: [ahead/behind status]
- [Modified files]: [key changes]
- [Untracked files]: [new files added]

---

## 🎯 TASK SPECIFICATION

### Objective
[Clear, measurable objective in 1-2 sentences]

### Requirements (MUST HAVE)
- [ ] [Specific requirement 1]
- [ ] [Specific requirement 2]
- [ ] [Technical constraint 1]
- [ ] [Technical constraint 2]

### Nice to Have (SHOULD HAVE)
- [ ] [Enhancement 1]
- [ ] [Optimization 1]
- [ ] [Edge case handling]

### Acceptance Criteria
- [ ] [Testable outcome 1]
- [ ] [Testable outcome 2]
- [ ] [Performance metric]
- [ ] [Code quality standard]

---

## 🔧 IMPLEMENTATION DETAILS

### Code Patterns to Follow
**Import Style**: ESM only (`import`/`export`), workspace protocol for internal packages
**Component Style**: Functional components with hooks, named exports
**Type Safety**: Strict TypeScript, explicit types over `any`
**Formatting**: Biome config (single quotes, no semicolons, ES6 trailing commas)

### Files to Modify/Create
1. **[Primary File]**: [Specific changes needed]
2. **[Secondary File]**: [Supporting changes]
3. **[Test File]**: [Test updates required]

### API/Function Signatures
```typescript
// Expected interface
interface [ComponentName]Props {
  [prop]: [type];
  [prop]: [type];
}

// Expected function signature
export function [functionName]([params]): [returnType] {
  // Implementation approach
}
```

---

## 🚫 CONSTRAINTS & ANTI-PATTERNS

### Forbidden Patterns
- ❌ GraphQL usage (REST APIs and RPC only)
- ❌ CommonJS (`require`/`module.exports`)
- ❌ `any` type usage
- ❌ Default exports
- ❌ `npx` commands (use `pnpm dlx`)
- ❌ Double quotes for strings (single quotes only)

### Required Patterns
- ✅ ESM imports/exports
- ✅ Named exports
- ✅ Functional components
- ✅ Async/await over Promises
- ✅ JSDoc comments for public APIs

---

## 🧪 VALIDATION & TESTING

### Verification Steps
1. **Type Check**: `pnpm typecheck`
2. **Lint**: `pnpm lint`
3. **Build**: `pnpm build`
4. **Tests**: `pnpm test` (unit/integration)
5. **Manual Test**: [Specific manual verification steps]

### Expected Test Results
- [ ] All existing tests pass
- [ ] New tests added for [specific functionality]
- [ ] Integration tests verify [end-to-end flow]

---

## 🔄 DEVELOPMENT LIFECYCLE

### Current Phase: [PHASE_NAME]
**Status**: [Not Started | In Progress | Ready for Review]

### Next Phase Actions
1. **Immediate Next**: [What to do after this task]
2. **Validation**: [How to verify this phase is complete]
3. **Blockers**: [Any dependencies or prerequisites]
4. **Success Metrics**: [How to measure completion]

### Rollback Plan
- **If Issues**: [How to revert changes]
- **Backup State**: [Current working commit/tag]

---

## 📚 REFERENCE & CONTEXT

### Related Files
- [File path]: [Why it's relevant]
- [File path]: [Why it's relevant]

### Similar Patterns
- [Existing implementation]: [Location and why it applies]
- [Design pattern]: [How it should be applied here]

### Documentation Links
- [API docs]: [Relevant section]
- [Architecture docs]: [Relevant patterns]
- [Testing guides]: [Applicable testing approaches]

---

## 💡 ADDITIONAL CONTEXT

### Business Logic
[Domain-specific requirements, user flows, edge cases]

### Performance Considerations
[Bundle size impact, runtime performance, memory usage]

### Security Considerations
[Authentication, authorization, input validation, XSS prevention]

### Accessibility
[ARIA labels, keyboard navigation, screen reader support]

---

## 🎯 SUCCESS CRITERIA

**Task Complete When**:
1. [Measurable outcome 1]
2. [Measurable outcome 2]
3. [Quality gate passed]
4. [Peer review ready]

**Definition of Done**:
- [ ] Code committed with clear message
- [ ] Tests passing
- [ ] Documentation updated
- [ ] No linting errors
- [ ] Build successful
- [ ] [Additional criteria specific to task]

---

## 📝 NOTES & REMINDERS

[Phase-specific notes, gotchas, or important reminders]

---

**USAGE**: Fill in the bracketed sections with task-specific details before providing to AI assistant.
```

### When to Use
- Complex multi-phase tasks
- Tasks requiring detailed planning and tracking
- Tasks with multiple stakeholders or reviewers
- High-risk changes requiring comprehensive documentation

---

## Code Review

Comprehensive code review template for systematic analysis of code changes.

### Template Structure

```
# 🔍 CODE REVIEW: [REVIEW_TYPE]
**Phase Description**: [Security review | Performance review | Architecture review | General code review]

---

## 📋 REVIEW CONTEXT

### Code Under Review
**Files**: [List of files being reviewed]
**Author**: [Original developer]
**PR/Commit**: [PR number or commit hash]
**Changes**: [Brief summary of changes]

### Review Scope
**Type**: [New feature | Bug fix | Refactoring | Performance | Security]
**Impact**: [Breaking change | Minor change | Patch]
**Risk Level**: [Low | Medium | High | Critical]

---

## 🎯 REVIEW OBJECTIVES

### Primary Goals
- [ ] [Main objective 1 - e.g., Verify functionality works as intended]
- [ ] [Main objective 2 - e.g., Ensure code follows project patterns]
- [ ] [Main objective 3 - e.g., Identify potential issues or improvements]

### Quality Gates
- [ ] Functionality verification
- [ ] Code style compliance
- [ ] Test coverage adequacy
- [ ] Performance impact assessment
- [ ] Security vulnerability check

---

## 🔧 REVIEW CHECKLIST

### Code Quality
- [ ] **Readability**: Clear variable names, comments, logical structure
- [ ] **Maintainability**: Modular design, separation of concerns
- [ ] **Type Safety**: Proper TypeScript usage, no `any` types
- [ ] **Error Handling**: Appropriate error boundaries and user feedback
- [ ] **Documentation**: JSDoc comments for public APIs

### Architecture & Patterns
- [ ] **Framework Compliance**: Follows RevealUI patterns and conventions
- [ ] **Component Design**: Proper separation of concerns, reusable components
- [ ] **State Management**: Appropriate state handling (local vs global)
- [ ] **API Design**: RESTful endpoints, proper error responses
- [ ] **Database Design**: Efficient queries, proper indexing

### Security Considerations
- [ ] **Input Validation**: Sanitization, type checking, bounds checking
- [ ] **Authentication**: Proper session handling, authorization checks
- [ ] **Data Exposure**: No sensitive data leaks, proper encryption
- [ ] **XSS Prevention**: Safe HTML rendering, proper escaping
- [ ] **CSRF Protection**: Appropriate protections in place

### Performance & Scalability
- [ ] **Bundle Size**: No unnecessary dependencies or large assets
- [ ] **Runtime Performance**: Efficient algorithms, minimal re-renders
- [ ] **Database Queries**: Optimized queries, proper indexing
- [ ] **Caching Strategy**: Appropriate caching for performance
- [ ] **Memory Leaks**: Proper cleanup, no subscription leaks

---

## 🚫 REQUIRED FIXES

### Critical Issues (Must Fix)
1. **[Issue 1]**: [Description and location]
2. **[Issue 2]**: [Description and location]

### Important Issues (Should Fix)
1. **[Issue 1]**: [Description and location]
2. **[Issue 2]**: [Description and location]

### Minor Issues (Nice to Fix)
1. **[Issue 1]**: [Description and location]
2. **[Issue 2]**: [Description and location]

---

## 💡 SUGGESTED IMPROVEMENTS

### Code Improvements
- [ ] [Improvement suggestion 1]
- [ ] [Improvement suggestion 2]

### Architecture Enhancements
- [ ] [Architectural suggestion 1]
- [ ] [Architectural suggestion 2]

### Testing Additions
- [ ] [Additional test case needed]
- [ ] [Test coverage gap identified]

---

## 🧪 TESTING VERIFICATION

### Test Coverage Analysis
- [ ] Unit tests: [Coverage %] - [Adequate/Inadequate]
- [ ] Integration tests: [Coverage %] - [Adequate/Inadequate]
- [ ] E2E tests: [Coverage %] - [Adequate/Inadequate]

### Manual Testing Checklist
- [ ] [Manual test case 1]
- [ ] [Manual test case 2]
- [ ] [Edge case verification]

---

## 🔄 REVIEW LIFECYCLE

### Review Status: [Draft | In Progress | Ready for Approval | Approved | Rejected]
**Review Round**: [1st pass | 2nd pass | Final review]

### Next Actions
1. **Immediate**: [Address critical issues / Implement suggestions / Additional testing]
2. **Follow-up**: [Schedule re-review / Performance testing / Documentation update]
3. **Approval Criteria**: [All critical issues fixed / Tests passing / Code standards met]

### Review Timeline
- **Started**: [Date/time]
- **Target Completion**: [Date/time]
- **Actual Completion**: [Date/time]

---

## 📚 REFERENCE & STANDARDS

### Project Standards
- **Code Style**: Biome configuration (single quotes, no semicolons, ES6 commas)
- **Architecture**: RevealUI  (Directory/Layer)-packages=domain/apps=presentation/infra=infrastructure layers
- **Testing**: Vitest + React Testing Library + Playwright
- **Documentation**: JSDoc for public APIs, README updates for features

### Similar Reviews
- [Previous similar review]: [Link or reference]
- [Best practices document]: [Link or reference]

---

## 🎯 REVIEW DECISION

**Recommendation**: [Approve | Request Changes | Reject]

**Rationale**:
[Detailed reasoning for the recommendation]

**Blocking Issues**: [List any issues that prevent approval]

**Conditional Approval**: [Requirements for approval if applicable]

---

## 📝 REVIEW NOTES

[Additional comments, concerns, or observations not covered above]

**Reviewer**: [Your name/handle]
**Review Date**: [Date]

---

**USAGE**: Use this template to structure comprehensive code reviews with actionable feedback and clear next steps.
```

### When to Use
- Pull request reviews
- Pre-merge code quality checks
- Security reviews
- Architecture reviews
- Performance reviews

---

## Debug Issue

Systematic debugging template for identifying and fixing software issues.

### Template Structure

```
# 🐛 DEBUG ISSUE: [ISSUE_TYPE]
**Phase Description**: Debugging [runtime error | build failure | test failure | performance issue | unexpected behavior]

---

## 📋 ISSUE CONTEXT

### Problem Description
**What**: [Clear description of the problem]
**When**: [When does it occur - startup, user action, API call, etc.]
**Where**: [File/component/page where issue manifests]
**Impact**: [User experience impact - blocking, annoying, cosmetic]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Expected vs Actual behavior]

### Environment
**Browser/OS**: [Chrome 120, macOS Sonoma, etc.]
**Node Version**: [24.12.0]
**Build**: [Development/Production]
**Branch/Commit**: [Current branch or commit hash]

---

## 🎯 DEBUG OBJECTIVES

### Primary Goals
- [ ] Identify root cause of the issue
- [ ] Implement reliable fix
- [ ] Add regression test
- [ ] Verify fix works across environments

### Success Criteria
- [ ] Issue no longer reproducible
- [ ] Code follows project standards
- [ ] No new issues introduced
- [ ] Test coverage added

---

## 🔧 DEBUG METHODOLOGY

### Investigation Steps
1. **Reproduce**: Confirm issue can be reproduced consistently
2. **Isolate**: Narrow down the code path causing the issue
3. **Inspect**: Use debugging tools to examine state and execution
4. **Hypothesize**: Form theory about root cause
5. **Test**: Validate hypothesis with targeted changes
6. **Fix**: Implement permanent solution

### Debug Tools Available
**Browser DevTools**: Console, Network, Application tabs
**React DevTools**: Component tree, props/state inspection
**VS Code Debugger**: Breakpoints, variable inspection
**Terminal**: `pnpm dev`, `pnpm build`, `pnpm test`
**Logs**: Console output, server logs, error boundaries

### Code Areas to Investigate
- [ ] [Suspected file/component 1]: [Why it's suspect]
- [ ] [Suspected file/component 2]: [Why it's suspect]
- [ ] [Related dependencies]: [API calls, state management, etc.]

---

## 🚫 COMMON DEBUG PATTERNS

### Don't Do
- ❌ Debug by randomly changing code
- ❌ Add console.log everywhere permanently
- ❌ Make large changes without understanding
- ❌ Ignore error messages or stack traces
- ❌ Test fixes only in one environment

### Do
- ✅ Read error messages carefully
- ✅ Use breakpoints strategically
- ✅ Isolate variables and state
- ✅ Test minimal reproducible cases
- ✅ Verify fixes across environments

---

## 🧪 DEBUG VALIDATION

### Test Cases to Verify
- [ ] Original reproduction case fails
- [ ] Fix works in all supported browsers
- [ ] No regression in existing functionality
- [ ] Edge cases still work correctly

### Verification Commands
```bash
# Development server
pnpm dev

# Build verification
pnpm build

# Test suite
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

---

## 🔄 DEBUG LIFECYCLE

### Current Phase: [Reproducing | Investigating | Hypothesizing | Testing Fix | Implementing]
**Status**: [Issue Reproduced | Root Cause Found | Fix Implemented | Testing | Ready for Review]

### Investigation Progress
- **Suspected Cause**: [Current theory about what's wrong]
- **Evidence**: [Logs, screenshots, code snippets supporting theory]
- **Confidence Level**: [Low | Medium | High]

### Next Debug Steps
1. **Immediate**: [Next specific debugging action]
2. **If Stuck**: [Alternative approaches or tools to try]
3. **Validation**: [How to confirm the fix works]

### Rollback Plan
- **Current State**: [What commit/branch to revert to if needed]
- **Backup Changes**: [Stash or branch with current work]

---

## 📚 DEBUG REFERENCE

### Similar Issues
- [Past similar issue]: [Solution or workaround used]
- [Framework documentation]: [Relevant docs for this type of issue]

### Debug Resources
- [RevealUI docs]: [Specific debugging guides]
- [Framework docs]: [React/Next.js debugging resources]
- [Tool documentation]: [Browser DevTools, React DevTools, etc.]

---

## 💡 DEBUG INSIGHTS

### Root Cause Analysis
[Analysis of what caused the issue - code bug, configuration, environment, etc.]

### Prevention Measures
[How to prevent this type of issue in the future]

### Documentation Updates Needed
[README, comments, or docs that should be updated to prevent similar issues]

---

## 🎯 DEBUG RESOLUTION

**Root Cause Identified**: [Yes/No]
**Fix Implemented**: [Yes/No]
**Test Added**: [Yes/No]
**Documentation Updated**: [Yes/No]

**Resolution Summary**:
[Detailed explanation of what was wrong and how it was fixed]

---

## 📝 DEBUG NOTES

[Debugging observations, gotchas encountered, important lessons learned]

**Debugger**: [Your name/handle]
**Debug Date**: [Date]
**Resolution Time**: [Time spent debugging]

---

**USAGE**: Use this systematic debugging template to methodically identify, fix, and prevent software issues.
```

### When to Use
- Runtime errors
- Build failures
- Test failures
- Performance issues
- Unexpected behavior

---

## Test Implementation

Comprehensive testing template for implementing unit, integration, and E2E tests.

### Template Structure

```
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
```

### When to Use
- Writing new unit tests
- Adding integration tests
- Creating E2E tests
- Improving test coverage
- Debugging failing tests

---

## Analyze Task

Simple task analysis template for quick structured analysis.

### How to Use
Type `/analyze` in Cursor chat and paste your task description.

### What Gets Analyzed
- **Task Type**: Bug fix, feature, refactor, test, documentation, etc.
- **Complexity**: Quick fix vs complex multi-step task
- **Files**: Relevant source files, tests, configs
- **Requirements**: Extracted from natural language description
- **Constraints**: Technical limitations and project rules
- **Success Criteria**: Measurable outcomes
- **Risks**: Potential blockers or challenges
- **Next Steps**: Immediate actionable items

### Example

**Input:**
```
Users getting 500 errors when logging in with emails containing special characters like @test+tag@gmail.com. The API crashes in the auth validation step.
```

**AI Analysis Output:**
```
🎯 Bug Fix: Email validation crashes with special characters

Files: packages/auth/src/server/auth.ts, packages/auth/src/__tests__/integration/auth-flow.test.ts
Context: API crashes on emails with + symbols and other special chars in local part

Requirements:
- [ ] Add proper email validation that handles RFC 5322 compliant addresses
- [ ] Add test cases for special characters in emails
- [ ] Ensure no regression for normal email addresses

Constraints:
- ESM only (no CommonJS)
- Use existing validation utilities
- Maintain backward compatibility

Success:
- [ ] Special character emails work without crashes
- [ ] All existing auth tests still pass
- [ ] New test cases added and passing

Next: Implement RFC-compliant email validation function
```

### Analysis Intelligence

The AI considers:
- **Project Context**: RevealUI framework patterns and constraints
- **Technical Stack**: React 19, Next.js 16, TypeScript, Vitest
- **Common Patterns**: How similar issues were solved in the codebase
- **Testing Requirements**: What test coverage is needed
- **Security Implications**: Any security considerations
- **Performance Impact**: Will this affect app performance?

### Customization

The analysis adapts based on:
- **Task Domain**: Auth, UI, API, database, testing, etc.
- **Urgency**: Critical bug vs nice-to-have feature
- **Scope**: Single file vs multi-package change
- **Dependencies**: What other systems are affected

### Integration

Results integrate with:
- **Git Workflow**: Branch naming suggestions
- **Testing Strategy**: Which test types to prioritize
- **Code Review**: What reviewers to include
- **Deployment**: Any special deployment considerations

---

**Ready to analyze any development task with AI-powered intelligence!**
