# 🤖 Smart Development Analyzer

## Overview
AI-powered development task analysis that automatically creates comprehensive implementation plans from natural language descriptions.

## How to Use
1. Type `/smart-dev` in Cursor chat
2. Provide a natural language description of your development task
3. The AI will analyze and generate a complete structured plan

## What It Does
- **Task Classification**: Identifies task type (bug-fix, feature, refactor, test, etc.)
- **Complexity Assessment**: Evaluates effort level and priority
- **Requirement Extraction**: Pulls specific needs from your description
- **File Identification**: Suggests relevant source files to modify
- **Technical Planning**: Creates implementation approach and constraints
- **Risk Analysis**: Identifies potential blockers and issues
- **Success Criteria**: Defines measurable completion standards
- **Implementation Phases**: Provides step-by-step execution plan

## Validation Requirements
**CRITICAL**: All changes must pass validation before implementation

### Pre-Change Validation (Required)
- **Type Checking**: Run `pnpm typecheck:all` before any file modifications
- **Linting**: Run `pnpm lint` to identify existing code quality issues
- **Test Baseline**: Run `pnpm test` to establish current test status

### Per-Change Validation (Mandatory)
- **After Each Change**: Must pass all three validations before proceeding:
  1. **Type Checking**: `pnpm typecheck:all` - No TypeScript errors
  2. **Linting**: `pnpm lint` - No linting violations
  3. **Testing**: `pnpm test` - All tests passing (including new tests)

### Implementation Blocking
- **❌ Cannot proceed** if any validation fails
- **🔄 Must fix issues** before continuing to next change
- **📋 Document pre-existing issues** separately from new work
- **🚫 No exceptions** - All validations must pass for each change

### Validation Integration
- **Automatic Checks**: Include validation commands in implementation plans
- **Error Handling**: Plan for validation failures and rollback procedures
- **Success Metrics**: Include validation passing as success criteria

## RevealUI Context
Automatically includes:
- ESM-only imports, named exports preferred
- No GraphQL (REST + RPC only)
- TypeScript strict mode
- Async/await over promises
- JSDoc comments for public APIs

## Example Usage

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

## Benefits
- **Structured Planning**: Transforms vague task descriptions into actionable development plans
- **Comprehensive Analysis**: Considers technical, business, and risk factors
- **Documentation**: Saves analysis to `docs/analyses/` for future reference
- **Consistency**: Standardized approach across all development tasks
- **Time Savings**: Instant analysis instead of manual planning

## Integration
- **Analysis Storage**: Automatically saves to `docs/analyses/` with metadata
- **Code Generation**: Compatible with `/generate-code` for implementation
- **Team Workflow**: Standardized planning process across team members

## Tips for Best Results
- **Be Specific**: Include error messages, stack traces, user impact
- **Provide Context**: Mention affected features, user flows, business requirements
- **Include Examples**: Show problematic input/output if applicable
- **Mention Files**: If you know which files are involved, include them

---

**Ready to analyze any development task with AI-powered intelligence!** 🚀🤖