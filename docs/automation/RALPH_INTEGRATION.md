# Ralph Integration - Cohesion Engine

**Status**: ✅ **Complete**

## Overview

Phase 4 integrates the Cohesion Engine with the Ralph iterative workflow system, enabling automated cohesion improvement as part of iterative development workflows.

## Features

- **Iterative Workflow**: Run cohesion analysis, assessment, and fixes as part of Ralph iterations
- **Stage Tracking**: Tracks progress through analyze → assess → fix → complete stages
- **Status Reporting**: View current workflow status and progress
- **Ralph Integration**: Seamlessly integrates with existing Ralph workflow commands

## Usage

### Start a Cohesion Workflow

```bash
# Start Ralph workflow with cohesion engine
pnpm ralph:start "Improve codebase cohesion" --completion-promise "DONE"

# Run cohesion workflow as iteration
pnpm cohesion:ralph workflow
```

### Check Status

```bash
# Check cohesion workflow status
pnpm cohesion:ralph status

# Check Ralph workflow status (includes cohesion)
pnpm ralph:status
```

### Continue Workflow

```bash
# Continue Ralph workflow (cohesion engine will continue from last stage)
pnpm ralph:continue
```

## Workflow Stages

The cohesion workflow runs through these stages automatically:

1. **Analyze** - Run `pnpm cohesion:analyze`
   - Scans codebase for cohesion issues
   - Generates analysis JSON
   - Records grade and issue count

2. **Assess** - Run `pnpm cohesion:assess`
   - Generates brutally honest assessment document
   - Creates `DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md`

3. **Fix (Dry Run)** - Run `pnpm cohesion:fix --dry-run`
   - Shows what fixes would be applied
   - Requires manual review before applying

4. **Complete** - All stages finished
   - Ready for next iteration or completion

## State Management

Cohesion workflow state is stored in:
- `.cursor/cohesion-ralph-state.json` - Cohesion-specific state
- `.cursor/ralph-loop.local.md` - Ralph workflow state (iteration tracking)

## Integration Points

- **Ralph Workflow**: Uses Ralph's iteration tracking and completion detection
- **Cohesion Commands**: Calls `cohesion:analyze`, `cohesion:assess`, `cohesion:fix` as needed
- **Progress Tracking**: Stores stage completion and metrics in separate state file

## Example Workflow

```bash
# 1. Start Ralph workflow
pnpm ralph:start "Improve cohesion" --completion-promise "DONE"

# 2. Run cohesion workflow (first iteration)
pnpm cohesion:ralph workflow
# → Runs analysis stage

# 3. Continue (next iteration)
pnpm cohesion:ralph workflow
# → Runs assessment stage

# 4. Continue (next iteration)
pnpm cohesion:ralph workflow
# → Runs fix dry-run stage

# 5. Review fixes, then apply manually if needed
pnpm cohesion:fix  # Remove --dry-run to apply

# 6. Mark complete
echo "DONE" > .cursor/ralph-complete.marker

# 7. Continue to completion
pnpm ralph:continue
```

## Commands

### `pnpm cohesion:ralph workflow`

Runs the cohesion workflow as a Ralph iteration. Automatically progresses through stages:
- Runs analysis if not complete
- Runs assessment if analysis complete
- Runs fixes (dry-run) if assessment complete

### `pnpm cohesion:ralph status`

Shows current cohesion workflow status:
- Current stage
- Iteration number
- Stage completion status
- Grade and metrics

## State File Format

`.cursor/cohesion-ralph-state.json`:

```json
{
  "stage": "assess",
  "analysis_complete": true,
  "assessment_complete": false,
  "fixes_applied": false,
  "last_grade": "D+ (Functional but Painful)",
  "issues_found": 5,
  "fixes_applied_count": 0
}
```

## Completion Detection

The cohesion workflow respects Ralph's completion promise mechanism:
- If completion marker matches promise, workflow completes
- State is saved and workflow can be continued later
- All stages are idempotent (safe to re-run)

## Error Handling

- Analysis failures are caught and reported
- Assessment failures are caught and reported
- Fix failures are caught and reported
- State is preserved between iterations
- Workflow can be resumed after errors

## See Also

- `RALPH_COHESION_ENGINE_RESEARCH.md` - Research and design
- `README.md` - Cohesion engine documentation
- `STATUS.md` - Implementation status
