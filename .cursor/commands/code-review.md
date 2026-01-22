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
- **Architecture**: RevealUI domain/application/infrastructure layers
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