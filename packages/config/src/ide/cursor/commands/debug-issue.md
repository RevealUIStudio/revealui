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