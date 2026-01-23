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