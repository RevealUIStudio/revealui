# 🤖 Intelligent Task Analysis Workflow

## How to Use
1. Type `/analyze` in Cursor chat
2. Paste your task description, error message, or requirements
3. The AI will automatically analyze and create a structured development plan

## What Gets Analyzed
- **Task Type**: Bug fix, feature, refactor, test, documentation, etc.
- **Complexity**: Quick fix vs complex multi-step task
- **Files**: Relevant source files, tests, configs
- **Requirements**: Extracted from natural language description
- **Constraints**: Technical limitations and project rules
- **Success Criteria**: Measurable outcomes
- **Risks**: Potential blockers or challenges
- **Next Steps**: Immediate actionable items

## Example Input → Output

**Input:**
```
Users getting 500 errors when logging in with emails containing special characters like @test+tag@gmail.com. The API crashes in the auth validation step.
```

**AI Analysis → Structured Output:**
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

## Analysis Intelligence

The AI considers:
- **Project Context**: RevealUI framework patterns and constraints
- **Technical Stack**: React 19, Next.js 16, TypeScript, Vitest
- **Common Patterns**: How similar issues were solved in the codebase
- **Testing Requirements**: What test coverage is needed
- **Security Implications**: Any security considerations
- **Performance Impact**: Will this affect app performance?

## Customization

The analysis adapts based on:
- **Task Domain**: Auth, UI, API, database, testing, etc.
- **Urgency**: Critical bug vs nice-to-have feature
- **Scope**: Single file vs multi-package change
- **Dependencies**: What other systems are affected

## Integration

Results integrate with:
- **Git Workflow**: Branch naming suggestions
- **Testing Strategy**: Which test types to prioritize
- **Code Review**: What reviewers to include
- **Deployment**: Any special deployment considerations

---

**Try it:** Type `/analyze` and paste any development task for instant structured analysis! 🚀