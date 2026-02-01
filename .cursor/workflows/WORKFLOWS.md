# Cursor Workflows - Complete Reference

**Reusable workflows for common development tasks** in the RevealUI Framework

This document provides step-by-step workflows for completing specific tasks efficiently.

---

## 📋 What Are Workflows?

Workflows define standardized processes for completing specific development tasks. Each workflow provides:
- The task or goal
- Step-by-step instructions
- Required files and locations
- Validation steps
- Common pitfalls to avoid

## 🎯 Available Workflows

- **Complete AI-Powered Development** - From task description to working code
- **Analyze Console Errors** - Capture and analyze browser console errors using MCP (⚠️ Experimental)
- **Intelligent Task Analysis** - Convert natural language to structured plans
- **New React Component** - Create new React components with proper structure
- **Ralph-Inspired Iterative** - Manual iterative development with state management

## 💡 Usage

Reference workflows in Cursor chat:
- "Follow the new component workflow"
- "Use the console error analysis workflow"
- "Apply the bug fix workflow"

---

## Table of Contents

1. [Complete AI-Powered Development Workflow](#complete-ai-powered-development-workflow)
2. [Analyze Console Errors Workflow](#analyze-console-errors-workflow)
3. [Intelligent Task Analysis Workflow](#intelligent-task-analysis-workflow)
4. [New React Component Workflow](#new-react-component-workflow)
5. [Ralph-Inspired Iterative Workflow](#ralph-inspired-iterative-workflow)

---

## Complete AI-Powered Development Workflow

Live demonstration of the complete AI-powered development system from task description to working code.

### Real-World Example: Email Validation Bug Fix

#### Phase 1: Task Description
```
Users getting 500 errors when logging in with emails containing @test+tag@gmail.com.
API crashes in auth validation step. Blocking Gmail alias users.
```

#### Phase 2: Smart Analysis (`/smart-dev`)

**Command executed:**
```bash
/smart-dev --interactive
# User pastes the task description above
```

**AI Analysis Generated:**
```
🤖 Smart Development Analysis

Task Classification
Type: bug-fix
Complexity: small-task
Priority: high

Understanding
Core Problem: Authentication API crashes when validating emails with special characters like Gmail aliases
Why It Matters: Blocks user registration and login for users with Gmail aliases (+ symbols)
Current State: API throws 500 errors instead of handling special characters properly

Solution Requirements
Must Do:
- Update email validation to handle RFC 5322 compliant email addresses
- Add test cases for emails with + symbols and other special characters
- Ensure existing email validation continues to work

Technical Approach
Files to Modify: packages/auth/src/server/auth.ts, packages/auth/src/__tests__/integration/auth-flow.test.ts
Key Changes: Update email validation regex/function to handle Gmail aliases and special characters
Testing Strategy: Add integration tests for various email formats, ensure no regression

Constraints & Rules
RevealUI Standards:
- ESM only (no CommonJS)
- Named exports preferred
- No GraphQL (REST + RPC only)
- TypeScript strict mode

Success Validation
Definition of Done:
- Emails with + symbols work for registration and login
- All existing auth tests still pass
- New test cases added for special character emails

Implementation Plan
Phase 1: Update email validation function in auth.ts
Phase 2: Add comprehensive test cases
Phase 3: Test and verify no regressions

Estimated Time: 4hrs

Risks & Considerations
- Overly permissive validation could allow invalid emails
- Performance impact of more complex regex
```

**Analysis automatically saved to:** `docs/analyses/2024-01-27-bug-fix-users-getting-500-errors-when-logging-in-with-emails-containing-test-tag-gmail-com.md`

#### Phase 3: Code Generation (`/generate-code`)

**Command executed:**
```bash
/generate-code --analysis="[paste the complete analysis above]"
```

**Code Generation Process:**
```
📋 Implementation Plan Generated:
Task: bug-fix (small-task)
Files to modify: 2
Changes to make: 3
Estimated time: 4hrs

🔍 DRY RUN - Preview of changes (no files will be modified):
===========================================
📁 Files to be modified:
  • packages/auth/src/server/auth.ts
  • packages/auth/src/__tests__/integration/auth-flow.test.ts

🔧 Changes to apply:
  1. Add email validation function
     File: packages/auth/src/server/auth.ts
     Type: modify
     Content preview:
       export function validateEmail(email: string): boolean {
         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
         return emailRegex.test(email)
       }

  2. Add test cases for special characters
     File: packages/auth/src/__tests__/integration/auth-flow.test.ts
     Type: create
     Content preview:
       describe('Email validation edge cases', () => {
         it('should accept Gmail aliases with +', () => {
           expect(validateEmail('test+tag@gmail.com')).toBe(true)
         })
       })

🚨 This will modify 2 files. Continue? (Y/n): y

⚡ Applying code changes...

✅ Code generation completed successfully!

📁 Files modified:
  • packages/auth/src/server/auth.ts
  • packages/auth/src/__tests__/integration/auth-flow.test.ts

🧪 Next steps:
1. Review the generated code
2. Run tests to verify functionality
3. Make any necessary adjustments
4. Commit changes when ready
```

#### Phase 4: Analysis Management

**View saved analyses:**
```bash
./scripts/manage-analyses.sh status
```
**Output:**
```
🤖 Analysis Status
==================
📊 Statistics:
  Total analyses: 1
  Recent (7 days): 1
  This month: 1

🎯 Task Types:
  Bug fixes: 1

📅 Recent Activity:
  • 2024-01-27-bug-fix-users-getting-500-errors-when-logging-in-with-emails-containing-test-tag-gmail-com.md
```

**Search analyses:**
```bash
./scripts/manage-analyses.sh search email
```
**Output:**
```
🔍 Searching for: email
==========================
2024-01-27-bug-fix-users-getting-500-errors-when-logging-in-with-emails-containing-test-tag-gmail-com.md:
  **Core Problem:** Authentication API crashes when validating emails with special characters like Gmail aliases
  - Update email validation to handle RFC 5322 compliant email addresses
  - Add test cases for emails with + symbols and other special characters
  - Ensure existing email validation continues to work
```

### Results: Complete Development Workflow

#### What Was Accomplished

1. **Smart Analysis**
   - AI analyzed natural language task description
   - Identified task type (bug-fix), complexity (small-task), priority (high)
   - Extracted requirements and technical approach
   - Saved comprehensive analysis to `docs/analyses/`

2. **Code Generation**
   - AI generated actual code changes based on analysis
   - Created email validation function with RFC 5322 compliance
   - Added comprehensive test cases for edge cases
   - Modified existing auth endpoint safely

3. **Documentation**
   - Analysis automatically saved with metadata
   - Implementation plan preserved for future reference
   - Searchable archive for team knowledge

4. **Safety & Control**
   - Dry-run preview before changes
   - Confirmation prompts for file modifications
   - Human review required before commit
   - No dangerous operations (no file deletion)

#### Productivity Impact

**Traditional Approach:**
- Manually analyze problem: 30 min
- Research email validation: 30 min
- Plan implementation: 30 min
- Write code changes: 60 min
- Write tests: 30 min
- Document solution: 30 min
**Total: 4.5 hours**

**AI-Powered Approach:**
- `/smart-dev` analysis: 2 min
- Review generated plan: 3 min
- `/generate-code` implementation: 5 min
- Review/test generated code: 10 min
**Total: 20 minutes**

**Productivity Gain: 95% faster development**

### Workflow Commands Summary

| Command | Purpose | Saves To |
|---------|---------|----------|
| `/smart-dev` | Analyze tasks → Implementation plans | `docs/analyses/` |
| `/generate-code` | Generate code from analyses | Modifies source files |
| `./scripts/manage-analyses.sh` | Manage analysis archive | N/A |

### Optional Commands
- `/dev` - Manual development template
- `/test-implementation` - Testing-focused analysis
- `/code-review` - Code review templates
- `/debug-issue` - Debugging assistance

### The Complete AI-Powered Development System

**From natural language task description to working code in minutes:**

1. **Describe Task** → Paste problem description
2. **AI Analysis** → Comprehensive implementation plan
3. **Code Generation** → Working code with tests
4. **Documentation** → Preserved for future reference
5. **Team Knowledge** → Searchable analysis archive

**This transforms development from manual planning and coding to AI-assisted execution while maintaining human control and quality standards.**

---

## Analyze Console Errors Workflow

**EXPERIMENTAL** - Step-by-step workflow for capturing and analyzing browser console errors using the Next.js Error Analyzer Agent.

### Overview

This workflow uses:
1. **Playwright MCP** - Captures browser console errors
2. **Next.js DevTools MCP** - Analyzes errors in detail
3. **Next.js Error Analyzer Agent** - Suggests fixes (requires manual verification)

### Prerequisites

1. Next.js dev server running (`pnpm --filter cms dev`)
2. Dev server accessible at `http://localhost:4000`
3. Playwright MCP configured (`.cursor/mcp-config.json`)
4. Next.js DevTools MCP configured

### Workflow Steps

#### Step 1: Start Dev Server

```bash
pnpm --filter cms dev
```

Wait for server to be ready (usually `✓ Ready in Xs` message).

#### Step 2: Trigger Error Analyzer Agent

Simply ask in Cursor:

```
Use the Next.js Error Analyzer Agent to capture and analyze console errors
```

The agent will attempt to:
- Navigate to your dev server using Playwright MCP
- Capture console errors, warnings, network failures
- Extract error details (stack traces, file locations, line numbers)
- Analyze errors using Next.js DevTools MCP
- **Suggest fixes** (you must review and approve before applying)

**No need to:**
- Open browser devtools (F12)
- Click on errors to copy them
- Manually paste error messages
- Navigate to error sources

Everything is captured automatically by Playwright MCP!

#### Step 3: Agent Workflow (Automatic)

The agent will:

1. **Capture Errors**
   - Navigate to `http://localhost:4000` via Playwright
   - Capture console.errors, console.warnings
   - Capture uncaught exceptions
   - Capture network failures (4xx, 5xx)

2. **Analyze Errors**
   - Use Next.js DevTools MCP `get_errors` tool
   - Get build-time errors
   - Get runtime errors with file/line/column info
   - Categorize errors by type

3. **Classify and Prioritize**
   - Critical errors first (crashes, build failures)
   - Then warnings and non-critical issues
   - Group related errors together

4. **Suggest Fixes**
   - Import/module errors → Suggest import path corrections
   - TypeScript errors → Suggest type additions/corrections
   - Hydration errors → Suggest server/client mismatch fixes
   - Next.js API errors → Suggest async params/route handler fixes
   - Environment errors → Suggest missing env vars

5. **Review Suggestions** (Manual Step Required)
   - Agent presents suggested fixes
   - **You review each suggestion**
   - **You approve or reject changes**
   - Agent applies only approved fixes

6. **Verify (Optional)**
   - Re-navigate and capture console again
   - Confirm errors are resolved
   - Report remaining issues

#### Step 4: Review and Apply Changes

**IMPORTANT: Always review before applying!**

1. **Review suggestions** - Check all suggested fixes carefully
2. **Approve or reject** - Only apply fixes you understand and trust
3. **Check the diff** - Review all file changes before committing
4. **Manual testing** - Test affected functionality after applying fixes
5. **Run tests** - Use testing agent to verify fixes don't break existing tests

#### Step 5: Handle Unfixable Errors

If agent reports errors it cannot fix:

1. **Read error explanation** - Agent will explain why
2. **Manual intervention** - Fix manually or ask for help
3. **Business logic errors** - May need domain knowledge
4. **Third-party issues** - Check library documentation

### Example Session

```
User: Use the Next.js Error Analyzer Agent workflow

Agent: Starting auto-fix workflow...

[Step 1: Capture]
✅ Navigating to http://localhost:4000
✅ Captured console output:
   - Error: Cannot find module '@/lib/components/Button' (Header.tsx:15)
   - Warning: Hydration failed in Button component
   - Error: params is not a function (app/[slug]/page.tsx:8)

[Step 2: Analyze]
✅ Using Next.js DevTools MCP to get detailed error info
✅ Build errors: 2
✅ Runtime errors: 1

[Step 3: Classify]
✅ Import error: Header.tsx
✅ Hydration error: Button.tsx
✅ Next.js API error: app/[slug]/page.tsx

[Step 4: Fix]
✅ Fixed: Changed import path '@/lib/components/Button' → '@/lib/components/ui/Button'
✅ Fixed: Added suppressHydrationWarning to Button component
✅ Fixed: Added await to params: const { slug } = await params

[Step 5: Verify]
✅ Re-capturing console errors...
✅ All errors resolved! ✓

Summary:
- 3 errors fixed
- 0 errors remaining
- Files modified: Header.tsx, Button.tsx, page.tsx
```

### Common Error Patterns

#### Pattern 1: Import Errors

**Symptom:** `Cannot find module '@/lib/...'`

**Agent Fix:**
- Checks actual file location
- Verifies `tsconfig.json` paths
- Updates import to correct path

#### Pattern 2: TypeScript Errors

**Symptom:** `Property 'X' does not exist on type 'Y'`

**Agent Fix:**
- Adds proper types or type assertions
- Updates interface definitions
- Fixes type imports

#### Pattern 3: Hydration Errors

**Symptom:** `Hydration failed because the initial UI does not match`

**Agent Fix:**
- Identifies mismatched rendering
- Adds `suppressHydrationWarning` where safe
- Fixes conditional rendering logic

#### Pattern 4: Next.js 16 Async Params

**Symptom:** `params is not a function` or `params is undefined`

**Agent Fix:**
- Adds `await` to params: `const { slug } = await params`
- Adds `await` to searchParams
- Ensures `export const dynamic = "force-dynamic"`

### Troubleshooting

#### Issue: Playwright MCP can't connect

**Solution:**
- Verify dev server is running
- Check port 4000 is accessible
- Ensure Playwright MCP is configured

#### Issue: Next.js DevTools MCP returns no errors

**Solution:**
- Verify Next.js 16+ is running
- Check `/_next/mcp` endpoint is accessible
- Restart dev server if needed

#### Issue: Fixes don't resolve errors

**Solution:**
- Review agent's explanation
- Check if error is business logic related
- Verify file paths are correct
- May need manual intervention

### Integration with Other Workflows

- **Component Creation** - Use after creating new components
- **Route Development** - Use after adding new routes
- **Type Refactoring** - Use after changing types
- **Testing** - Use before running tests to catch errors early

### Best Practices

1. **Run frequently** - Catch errors early
2. **Review fixes** - Always check the diff
3. **Test manually** - Verify fixes work
4. **Commit fixes** - Save working state
5. **Document edge cases** - Note any unfixable errors

**Tip:** Use this workflow regularly during development to maintain a clean console and catch errors early!

---

## Intelligent Task Analysis Workflow

Quick task analysis workflow for converting natural language descriptions into structured development plans.

### How to Use
1. Type `/analyze` in Cursor chat
2. Paste your task description, error message, or requirements
3. The AI will automatically analyze and create a structured development plan

### What Gets Analyzed
- **Task Type**: Bug fix, feature, refactor, test, documentation, etc.
- **Complexity**: Quick fix vs complex multi-step task
- **Files**: Relevant source files, tests, configs
- **Requirements**: Extracted from natural language description
- **Constraints**: Technical limitations and project rules
- **Success Criteria**: Measurable outcomes
- **Risks**: Potential blockers or challenges
- **Next Steps**: Immediate actionable items

### Example Input → Output

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

## New React Component Workflow

Step-by-step guide for creating a new React component.

### Steps

1. **Create Component File**
   - Location: `apps/cms/src/lib/components/YourComponent/index.tsx`
   - Use functional component with TypeScript
   - Add proper prop types with interface

2. **Add TypeScript Interface**
   ```typescript
   interface YourComponentProps {
     title: string;
     optional?: boolean;
   }
   ```

3. **Export Component**
   - Use named export: `export const YourComponent`
   - Create index file for clean imports

4. **Add Styling**
   - Use Tailwind CSS classes
   - Follow existing component patterns
   - Ensure responsive design

5. **Add to Storybook (if applicable)**
   - Create story file
   - Document props and usage

6. **Test Component**
   - Create unit test if complex logic
   - Test in isolation
   - Verify accessibility

### Template

```typescript
import React from "react";

interface YourComponentProps {
  title: string;
  description?: string;
}

export const YourComponent: React.FC<YourComponentProps> = ({
  title,
  description,
}) => {
  return (
    <div className="container">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
};
```

---

## Ralph-Inspired Iterative Workflow

Manual iterative development process inspired by the Ralph Wiggum concept. Uses state management and file-based completion markers to help you iterate on complex tasks until completion.

**Important**: This is **NOT an autonomous loop** (like the original Ralph Wiggum plugin). This is a **manual iterative workflow** that requires you to re-invoke commands to continue iterations.

### When to Use

Use this workflow for:
- Complex tasks that require multiple iterations
- Tasks that benefit from structured state management
- Tasks where you want to track progress across iterations
- Tasks with clear completion criteria

**Don't use this workflow for**:
- Simple tasks that complete in one iteration
- Tasks requiring real-time feedback (use regular development)
- Tasks without clear completion criteria

### How It Works

#### Core Concept

1. **Start** a workflow with a task description
2. **Work** on the task in Cursor chat
3. **Check** status and continue iterations
4. **Complete** by creating a marker file
5. **Clean up** automatically or manually

#### Key Components

- **State file** (`.cursor/ralph-loop.local.md`): Tracks iteration count, completion promise, and prompt
- **Prompt file** (`.cursor/ralph-prompt.md`): Stores the original task description
- **Completion marker** (`.cursor/ralph-complete.marker`): Signals task completion

### Step-by-Step Guide

#### 1. Start a Workflow

```bash
pnpm ralph:start "<task description>" --completion-promise "<promise>" --max-iterations <number>
```

**Examples**:
```bash
# Basic workflow
pnpm ralph:start "Build REST API for todos"

# With completion promise
pnpm ralph:start "Build REST API for todos" --completion-promise "DONE" --max-iterations 20

# Unlimited iterations
pnpm ralph:start "Refactor cache layer"
```

**Arguments**:
- `<task description>`: Your task or prompt (required)
- `--completion-promise, -p <text>`: Promise phrase to signal completion (optional)
- `--max-iterations, -n <number>`: Maximum iterations (default: 0 = unlimited)

#### 2. Work on the Task

Use Cursor chat to work on the task. The workflow doesn't interfere with your development process.

#### 3. Check Status

```bash
pnpm ralph:status
```

This shows:
- Current iteration number
- Maximum iterations (if set)
- Completion status
- Next steps

#### 4. Continue Iteration

```bash
pnpm ralph:continue
```

This will:
- Increment the iteration counter
- Check for completion marker
- Show the prompt for next iteration
- Clean up if complete or max iterations reached

#### 5. Signal Completion

If you set a completion promise, create a marker file when the task is complete:

```bash
echo "DONE" > .cursor/ralph-complete.marker
```

**Important**: The marker file content must **exactly match** your completion promise.

#### 6. Finalize

Run `pnpm ralph:continue` again to detect completion and clean up:

```bash
pnpm ralph:continue
```

The workflow will automatically clean up state files when complete.

#### 7. Cancel (if needed)

Cancel the workflow anytime:

```bash
pnpm ralph:cancel
```

This removes all workflow files and resets state.

### Writing Effective Prompts

#### Good Prompts

**Clear and specific**:
```
Build a REST API for todos with CRUD operations, input validation, and tests.
When complete: All tests passing, API documented, README updated.
```

**Incremental goals**:
```
Phase 1: Authentication (JWT, tests)
Phase 2: CRUD operations (tests)
Phase 3: Input validation (tests)
Complete when all phases done and tests passing.
```

**Measurable completion**:
```
Fix authentication bug. Complete when login tests pass and security review done.
```

#### Bad Prompts

**Too vague**:
```
Make it better.
```

**No completion criteria**:
```
Build an e-commerce platform.
```

**Unclear scope**:
```
Do the thing.
```

### Completion Detection

#### With Completion Promise

1. Set a completion promise when starting:
   ```bash
   pnpm ralph:start "Task" --completion-promise "DONE"
   ```

2. When task is complete, create marker file:
   ```bash
   echo "DONE" > .cursor/ralph-complete.marker
   ```

3. Run continue to detect completion:
   ```bash
   pnpm ralph:continue
   ```

#### Without Completion Promise

- Workflow runs until manually cancelled
- Use `pnpm ralph:continue` to track iterations
- Use `pnpm ralph:cancel` when done

### Error Handling

#### Corrupted State File

If state file becomes corrupted:
```bash
pnpm ralph:cancel  # Reset the workflow
pnpm ralph:start   # Start fresh
```

#### Concurrent Workflows

Only one workflow can be active at a time. If you try to start a new workflow while one is active:
- You'll get an error message
- Cancel the existing workflow first: `pnpm ralph:cancel`

#### Max Iterations Reached

If max iterations is reached:
- Workflow automatically cleans up
- You can still check final status
- Consider restarting if more work needed

### Best Practices

1. **Set clear completion criteria** using completion promises
2. **Use max iterations** to prevent infinite loops
3. **Check status regularly** to track progress
4. **Cancel if stuck** rather than letting iterations accumulate
5. **Document your prompts** (they're stored in `.cursor/ralph-prompt.md`)

### Troubleshooting

#### "No active workflow"

- Run `pnpm ralph:start` to begin a workflow
- Check if state file exists: `.cursor/ralph-loop.local.md`

#### "State file validation failed"

- State file may be corrupted
- Run `pnpm ralph:cancel` to reset
- Start a new workflow

#### "Completion marker not detected"

- Check marker file exists: `.cursor/ralph-complete.marker`
- Verify marker content matches completion promise exactly
- Check file content: `cat .cursor/ralph-complete.marker`

#### "Max iterations reached"

- Workflow completed (automatically cleaned up)
- Restart with higher max iterations if needed
- Or continue without max iterations (set to 0)

### Limitations

#### What This Workflow Is NOT

- **NOT autonomous**: Requires manual iteration (you must run commands)
- **NOT automatic**: Doesn't intercept exits or automatically loop
- **NOT Ralph Wiggum**: This is Ralph-inspired, not the original plugin

#### What This Workflow IS

- **Manual iteration**: You control when to continue
- **State management**: Tracks progress across iterations
- **Structured workflow**: Provides clear steps and guidance
- **Flexible**: Works with any development process

### Examples

#### Example 1: Feature Development

```bash
# Start workflow
pnpm ralph:start "Add user authentication with JWT" --completion-promise "AUTH_COMPLETE" --max-iterations 15

# Work in Cursor chat...
# (implement authentication, write tests, fix bugs)

# Check status
pnpm ralph:status

# Continue iteration
pnpm ralph:continue

# When complete
echo "AUTH_COMPLETE" > .cursor/ralph-complete.marker
pnpm ralph:continue  # Detects completion, cleans up
```

#### Example 2: Bug Fix

```bash
# Start workflow
pnpm ralph:start "Fix memory leak in cache system" --max-iterations 10

# Work on bug...
pnpm ralph:continue

# When fixed
pnpm ralph:cancel  # Manual completion (no promise set)
```

#### Example 3: Refactoring

```bash
# Start workflow (unlimited iterations)
pnpm ralph:start "Refactor database layer to use Drizzle ORM"

# Iterate as needed
pnpm ralph:status
pnpm ralph:continue

# Cancel when done
pnpm ralph:cancel
```

### Advanced Usage

#### For AI Agents

AI agents can use this workflow by:
1. Starting workflow: `pnpm ralph:start "Task" --completion-promise "DONE"`
2. Working on task
3. Checking status: `pnpm ralph:status`
4. Continuing: `pnpm ralph:continue`
5. Creating marker when complete: `echo "DONE" > .cursor/ralph-complete.marker`
6. Finalizing: `pnpm ralph:continue`

#### Integration with CI/CD

While this workflow is primarily for local development, state files could be:
- Committed to git (if desired, remove from .gitignore)
- Used in CI/CD pipelines for iteration tracking
- Shared across team members (with coordination)

### Related Commands

- `pnpm ralph:start` - Start a workflow
- `pnpm ralph:status` - Check status
- `pnpm ralph:continue` - Continue iteration
- `pnpm ralph:cancel` - Cancel workflow

For more information, see the [scripts documentation](../../scripts/README.md).

---

**Ready to streamline your development workflows!**
