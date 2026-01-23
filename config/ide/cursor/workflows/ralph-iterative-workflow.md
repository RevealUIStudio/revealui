# Ralph-Inspired Iterative Workflow

## Overview

This workflow provides a **manual iterative development process** inspired by the Ralph Wiggum concept. It uses state management and file-based completion markers to help you iterate on complex tasks until completion.

**Important**: This is **NOT an autonomous loop** (like the original Ralph Wiggum plugin). This is a **manual iterative workflow** that requires you to re-invoke commands to continue iterations.

## When to Use

Use this workflow for:
- Complex tasks that require multiple iterations
- Tasks that benefit from structured state management
- Tasks where you want to track progress across iterations
- Tasks with clear completion criteria

**Don't use this workflow for**:
- Simple tasks that complete in one iteration
- Tasks requiring real-time feedback (use regular development)
- Tasks without clear completion criteria

## How It Works

### Core Concept

1. **Start** a workflow with a task description
2. **Work** on the task in Cursor chat
3. **Check** status and continue iterations
4. **Complete** by creating a marker file
5. **Clean up** automatically or manually

### Key Components

- **State file** (`.cursor/ralph-loop.local.md`): Tracks iteration count, completion promise, and prompt
- **Prompt file** (`.cursor/ralph-prompt.md`): Stores the original task description
- **Completion marker** (`.cursor/ralph-complete.marker`): Signals task completion

## Step-by-Step Guide

### 1. Start a Workflow

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

### 2. Work on the Task

Use Cursor chat to work on the task. The workflow doesn't interfere with your development process.

### 3. Check Status

```bash
pnpm ralph:status
```

This shows:
- Current iteration number
- Maximum iterations (if set)
- Completion status
- Next steps

### 4. Continue Iteration

```bash
pnpm ralph:continue
```

This will:
- Increment the iteration counter
- Check for completion marker
- Show the prompt for next iteration
- Clean up if complete or max iterations reached

### 5. Signal Completion

If you set a completion promise, create a marker file when the task is complete:

```bash
echo "DONE" > .cursor/ralph-complete.marker
```

**Important**: The marker file content must **exactly match** your completion promise.

### 6. Finalize

Run `pnpm ralph:continue` again to detect completion and clean up:

```bash
pnpm ralph:continue
```

The workflow will automatically clean up state files when complete.

### 7. Cancel (if needed)

Cancel the workflow anytime:

```bash
pnpm ralph:cancel
```

This removes all workflow files and resets state.

## Writing Effective Prompts

### Good Prompts

✅ **Clear and specific**:
```
Build a REST API for todos with CRUD operations, input validation, and tests.
When complete: All tests passing, API documented, README updated.
```

✅ **Incremental goals**:
```
Phase 1: Authentication (JWT, tests)
Phase 2: CRUD operations (tests)
Phase 3: Input validation (tests)
Complete when all phases done and tests passing.
```

✅ **Measurable completion**:
```
Fix authentication bug. Complete when login tests pass and security review done.
```

### Bad Prompts

❌ **Too vague**:
```
Make it better.
```

❌ **No completion criteria**:
```
Build an e-commerce platform.
```

❌ **Unclear scope**:
```
Do the thing.
```

## Completion Detection

### With Completion Promise

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

### Without Completion Promise

- Workflow runs until manually cancelled
- Use `pnpm ralph:continue` to track iterations
- Use `pnpm ralph:cancel` when done

## Error Handling

### Corrupted State File

If state file becomes corrupted:
```bash
pnpm ralph:cancel  # Reset the workflow
pnpm ralph:start   # Start fresh
```

### Concurrent Workflows

Only one workflow can be active at a time. If you try to start a new workflow while one is active:
- You'll get an error message
- Cancel the existing workflow first: `pnpm ralph:cancel`

### Max Iterations Reached

If max iterations is reached:
- Workflow automatically cleans up
- You can still check final status
- Consider restarting if more work needed

## Best Practices

1. **Set clear completion criteria** using completion promises
2. **Use max iterations** to prevent infinite loops
3. **Check status regularly** to track progress
4. **Cancel if stuck** rather than letting iterations accumulate
5. **Document your prompts** (they're stored in `.cursor/ralph-prompt.md`)

## Troubleshooting

### "No active workflow"

- Run `pnpm ralph:start` to begin a workflow
- Check if state file exists: `.cursor/ralph-loop.local.md`

### "State file validation failed"

- State file may be corrupted
- Run `pnpm ralph:cancel` to reset
- Start a new workflow

### "Completion marker not detected"

- Check marker file exists: `.cursor/ralph-complete.marker`
- Verify marker content matches completion promise exactly
- Check file content: `cat .cursor/ralph-complete.marker`

### "Max iterations reached"

- Workflow completed (automatically cleaned up)
- Restart with higher max iterations if needed
- Or continue without max iterations (set to 0)

## Limitations

### What This Workflow Is NOT

- ❌ **NOT autonomous**: Requires manual iteration (you must run commands)
- ❌ **NOT automatic**: Doesn't intercept exits or automatically loop
- ❌ **NOT Ralph Wiggum**: This is Ralph-inspired, not the original plugin

### What This Workflow IS

- ✅ **Manual iteration**: You control when to continue
- ✅ **State management**: Tracks progress across iterations
- ✅ **Structured workflow**: Provides clear steps and guidance
- ✅ **Flexible**: Works with any development process

## Examples

### Example 1: Feature Development

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

### Example 2: Bug Fix

```bash
# Start workflow
pnpm ralph:start "Fix memory leak in cache system" --max-iterations 10

# Work on bug...
pnpm ralph:continue

# When fixed
pnpm ralph:cancel  # Manual completion (no promise set)
```

### Example 3: Refactoring

```bash
# Start workflow (unlimited iterations)
pnpm ralph:start "Refactor database layer to use Drizzle ORM"

# Iterate as needed
pnpm ralph:status
pnpm ralph:continue

# Cancel when done
pnpm ralph:cancel
```

## Advanced Usage

### For AI Agents

AI agents can use this workflow by:
1. Starting workflow: `pnpm ralph:start "Task" --completion-promise "DONE"`
2. Working on task
3. Checking status: `pnpm ralph:status`
4. Continuing: `pnpm ralph:continue`
5. Creating marker when complete: `echo "DONE" > .cursor/ralph-complete.marker`
6. Finalizing: `pnpm ralph:continue`

### Integration with CI/CD

While this workflow is primarily for local development, state files could be:
- Committed to git (if desired, remove from .gitignore)
- Used in CI/CD pipelines for iteration tracking
- Shared across team members (with coordination)

## Related Commands

- `pnpm ralph:start` - Start a workflow
- `pnpm ralph:status` - Check status
- `pnpm ralph:continue` - Continue iteration
- `pnpm ralph:cancel` - Cancel workflow

For more information, see the [scripts documentation](../../scripts/README.md).
