# AI & Development Integrations Guide

Comprehensive guide to AI agents, development tools, and quality systems integrated with RevealUI Framework.

## Table of Contents

1. [Claude Code Integration](#claude-code-integration)
2. [Ralph Workflow System](#ralph-workflow-system)
3. [Brutal Honesty System](#brutal-honesty-system)
4. [Integration Architecture](#integration-architecture)

---

## Claude Code Integration

This guide explains how to connect **Claude Code** (Anthropic's agentic CLI) to your **Antigravity** IDE and leverage the existing project infrastructure.

### Overview

RevealUI is built with extensive AI-agent infrastructure. You can interact with it through Anthropic's Claude Code CLI while working in the Antigravity IDE.

#### Integration Options

1. **Direct CLI Usage**: Run `claude` directly in Antigravity's integrated terminal.
2. **IDE Extension**: Use the official Claude Extension inside Antigravity (VS Code based).
3. **MCP Sharing**: Use RevealUI's pre-configured MCP servers in both environments.
4. **Agent Skills**: Use the `pnpm skills` CLI to manage agent capabilities.

### Option 1: Claude Code CLI (Recommended)

Running Claude Code in Antigravity's terminal gives the agent full access to your environment, build tools, and local servers.

#### Setup

1. **Install Claude Code globally**:
   ```bash
   pnpm add -g @anthropic-ai/claude-code
   ```

2. **Verify Configuration**:
   The project already contains a `.claude/` directory with `settings.local.json` which defines allowed permissions for the agent (e.g., `pnpm test`, `git`, etc.).

3. **Launch from Root**:
   Open the terminal in Antigravity and run:
   ```bash
   claude
   ```

### Option 2: MCP Integration

RevealUI includes several **Model Context Protocol (MCP)** servers that provide agents with "real-world" tools like database access and service management.

#### Shared MCP Servers

The project is configured to use:
- **Vercel MCP**: Manage deployments and storage.
- **Stripe MCP**: Manage payments and products.
- **Neon/Supabase MCP**: Query your production/dev databases.
- **Next.js DevTools MCP**: Inspect your application state.

#### Using MCP with Claude Code

Claude Code automatically looks for MCP configurations. If you are running the `pnpm dev` command, the local MCP servers are typically started automatically.

See `docs/mcp/MCP_SETUP.md` for detailed server configuration.

### Option 3: Agent Skills System

The RevealUI Framework includes a custom **Skills System** for agents. This allows you to "teach" Claude new capabilities by installing skills.

#### Skills CLI

Use the `pnpm skills` command in the Antigravity terminal:

```bash
pnpm skills list        # List installed skills
pnpm skills add <repo>  # Install a specific skill
pnpm skills info <name> # See what an agent can do with this skill
```

Skills typically include customized instructions (in `SKILL.md`) and specialized scripts that Claude can execute.

### Option 4: Antigravity-Claude Proxy

If you want to use Antigravity's models (like Gemini 2.0 Pro) *inside* the Claude Code CLI, you can use the community-built proxy.

1. **Install the proxy**:
   ```bash
   pnpm add -g antigravity-claude-proxy
   ```

2. **Configure Claude Code** to point to the local proxy endpoint.

3. This allows you to leverage Antigravity's generous quotas while using Claude's agentic interface.

---

## Ralph Workflow System

Ralph is an iterative workflow system that integrates with the Cohesion Engine for automated codebase improvements.

### Overview

Ralph provides:
- **Iterative Workflow**: Run cohesion analysis, assessment, and fixes as part of Ralph iterations
- **Stage Tracking**: Tracks progress through analyze → assess → fix → complete stages
- **Status Reporting**: View current workflow status and progress
- **Integration**: Seamlessly integrates with existing Ralph workflow commands

### Status

**Status**: ✅ **Complete**

Phase 4 integrates the Cohesion Engine with the Ralph iterative workflow system, enabling automated cohesion improvement as part of iterative development workflows.

### Usage

#### Start a Cohesion Workflow

```bash
# Start Ralph workflow with cohesion engine
pnpm ralph:start "Improve codebase cohesion" --completion-promise "DONE"

# Run cohesion workflow as iteration
pnpm cohesion:ralph workflow
```

#### Check Status

```bash
# Check cohesion workflow status
pnpm cohesion:ralph status

# Check Ralph workflow status (includes cohesion)
pnpm ralph:status
```

#### Continue Workflow

```bash
# Continue Ralph workflow (cohesion engine will continue from last stage)
pnpm ralph:continue
```

### Workflow Stages

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

### State Management

Cohesion workflow state is stored in:
- `.cursor/cohesion-ralph-state.json` - Cohesion-specific state
- `.cursor/ralph-loop.local.md` - Ralph workflow state (iteration tracking)

### Integration Points

- **Ralph Workflow**: Uses Ralph's iteration tracking and completion detection
- **Cohesion Commands**: Calls `cohesion:analyze`, `cohesion:assess`, `cohesion:fix` as needed
- **Progress Tracking**: Stores stage completion and metrics in separate state file

### Example Workflow

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

### Commands

#### `pnpm cohesion:ralph workflow`

Runs the cohesion workflow as a Ralph iteration. Automatically progresses through stages:
- Runs analysis if not complete
- Runs assessment if analysis complete
- Runs fixes (dry-run) if assessment complete

#### `pnpm cohesion:ralph status`

Shows current cohesion workflow status:
- Current stage
- Iteration number
- Stage completion status
- Grade and metrics

### State File Format

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

### Completion Detection

The cohesion workflow respects Ralph's completion promise mechanism:
- If completion marker matches promise, workflow completes
- State is saved and workflow can be continued later
- All stages are idempotent (safe to re-run)

### Error Handling

- Analysis failures are caught and reported
- Assessment failures are caught and reported
- Fix failures are caught and reported
- State is preserved between iterations
- Workflow can be resumed after errors

---

## Brutal Honesty System

Automatic assessment validation and enhancement system that ensures brutally honest code quality reports.

### Overview

**Status**: ✅ **Built into Ralph Workflow System**

Brutal honesty is now **built into** the Ralph workflow system and cohesion engine by default. You no longer need to explicitly request "brutal honesty" - it's automatic.

### How It Works

#### 1. Automatic Prompt Enhancement

When you start a Ralph workflow, brutal honesty requirements are automatically added to the prompt:

```bash
pnpm ralph:start "Assess codebase cohesion"
# Automatically includes brutal honesty requirements
```

**What Gets Added**:
- Brutal honesty criteria (blunt language, quantitative evidence, code examples)
- Explicit requirements (no euphemisms, realistic grades)
- Validation notice (assessment will be checked)

**To Disable** (not recommended):
```bash
pnpm ralph:start "Assess codebase" --no-brutal-honesty
```

#### 2. Automatic Assessment Validation

When assessments are generated, they're automatically validated for brutal honesty:

```bash
pnpm cohesion:assess
# Automatically validates brutal honesty score
# Enhances if needed
```

**Validation Checks**:
- ✅ Uses blunt, direct language (not euphemisms)
- ✅ Includes quantitative evidence (numbers, percentages)
- ✅ Includes code examples (file:line references)
- ✅ Identifies root causes (explains WHY)
- ✅ Uses severity ratings (CRITICAL/HIGH/MEDIUM/LOW)
- ✅ Provides honest grade (not inflated)
- ✅ Includes "Would I Use This" assessment

**Scoring**:
- **70+ points**: Passes brutal honesty validation
- **< 70 points**: Automatically enhanced, warnings shown

#### 3. Automatic Enhancement

If an assessment doesn't meet brutal honesty standards, it's automatically enhanced:

- Adds missing required phrases ("Bottom Line", "Would I Use This")
- Replaces euphemisms with direct language
- Adds missing sections

### Validation Criteria

#### Required Elements (Score: 0-100)

1. **Blunt Language** (15 points)
   - Uses words like "painful", "frustrating", "broken"
   - Avoids euphemisms like "needs improvement"

2. **Quantitative Evidence** (15 points)
   - Includes specific numbers (file counts, percentages)
   - Not vague like "some" or "many"

3. **Code Examples** (15 points)
   - Shows file:line references
   - Includes actual code snippets

4. **Root Cause Analysis** (10 points)
   - Explains WHY issues exist
   - Not just WHAT they are

5. **Avoids Euphemisms** (15 points)
   - No "could be improved" or "needs work"
   - Direct, honest language

6. **Severity Ratings** (10 points)
   - Uses CRITICAL/HIGH/MEDIUM/LOW
   - Not just "issues"

7. **Honest Grade** (10 points)
   - Realistic grade (D+, C-, etc.)
   - Not inflated

8. **"Would I Use This"** (10 points)
   - Honest assessment of production readiness
   - Clear recommendation

### Usage Examples

#### Cohesion Assessment (Automatic)

```bash
# Start Ralph workflow for cohesion improvement
pnpm ralph:start "Improve codebase cohesion" --completion-promise "DONE"

# Run cohesion workflow
pnpm cohesion:ralph workflow
# → Automatically includes brutal honesty
# → Validates assessments
# → Enhances if needed
```

#### Direct Assessment (Automatic)

```bash
# Generate assessment
pnpm cohesion:assess
# → Automatically validates brutal honesty
# → Shows score and violations
# → Enhances if needed
```

#### Manual Ralph Workflow (Automatic)

```bash
# Start any workflow
pnpm ralph:start "Refactor authentication system"
# → Automatically includes brutal honesty requirements in prompt
# → Agent will use brutal honesty by default
```

### What Gets Validated

#### Assessment Text

- Language patterns (blunt vs. euphemistic)
- Quantitative evidence presence
- Code example presence
- Required phrases ("Bottom Line", "Would I Use This")
- Severity ratings
- Grade presence

#### Analysis Results

- Grade inflation (A/B with critical issues = inflated)
- Missing severity ratings
- Missing evidence

### Output Examples

#### Passed Validation

```
✅ Brutal honesty validation passed (85/100)
```

#### Failed Validation (Auto-Enhanced)

```
⚠️  Brutal honesty score: 45/100
⚠️  Violations: 4
ℹ️  Enhancing assessment with brutal honesty...
  - Added "Bottom Line" section to executive summary
  - Replaced euphemism with blunt language
✅ Assessment now meets brutal honesty standards
```

#### Failed Validation (Needs Manual Review)

```
⚠️  Assessment still needs improvement. Score: 65/100. Suggestions:
  - Use words like "painful", "frustrating", "broken" instead of euphemisms
  - Include specific numbers (file counts, percentages, line numbers)
  - Include "Would I Use This" assessment
```

### Configuration

#### Enable/Disable Brutal Honesty

**Default**: Enabled for all workflows

**Disable for specific workflow**:
```bash
pnpm ralph:start "Assess codebase" --no-brutal-honesty
```

**Check if enabled**:
- Look for "Brutal honesty mode enabled" message when starting workflow

### Benefits

1. **No More Asking** - Brutal honesty is automatic
2. **Consistent Quality** - All assessments meet standards
3. **Automatic Enhancement** - Fixes violations automatically
4. **Clear Validation** - Shows score and violations
5. **Built-in Enforcement** - Can't skip brutal honesty

### Technical Details

#### Files

- `scripts/cohesion/utils/brutal-honesty.ts` - Validation and enhancement logic
- `scripts/cohesion/assess.ts` - Automatic validation on generation
- `scripts/cohesion/ralph.ts` - Validation in Ralph workflow
- `scripts/ralph/start.ts` - Automatic prompt enhancement

#### Functions

- `validateBrutalHonesty()` - Validates assessment text
- `enhanceWithBrutalHonesty()` - Enhances assessment if needed
- `generateBrutalHonestyPromptPrefix()` - Adds requirements to prompts
- `validateAnalysisForBrutalHonesty()` - Validates analysis results

### Future Enhancements

1. **Custom Rules** - Allow custom brutal honesty criteria
2. **Score Thresholds** - Configurable minimum scores
3. **Domain-Specific Rules** - Different rules for different domains
4. **Learning Mode** - Learn from manual corrections

---

## Integration Architecture

### System Overview

The integration architecture consists of three main components working together:

1. **Claude Code CLI** - Provides agentic AI interaction
2. **Ralph Workflow System** - Manages iterative development workflows
3. **Brutal Honesty System** - Ensures quality assessment standards

### Data Flow

```
User Command
    ↓
Claude Code CLI / Ralph Workflow
    ↓
Cohesion Analysis Engine
    ↓
Brutal Honesty Validation
    ↓
Assessment Enhancement (if needed)
    ↓
Automated Fixes (optional)
    ↓
State Persistence
```

### State Management

**Location**: `.cursor/` directory

**Files**:
- `cohesion-analysis.json` - Analysis results
- `cohesion-ralph-state.json` - Ralph workflow state
- `ralph-loop.local.md` - Iteration tracking
- `mcp-config.json` - MCP server configuration

### Integration Points

1. **Agent → Cohesion Engine**
   - Triggers analysis commands
   - Reads assessment results
   - Applies fixes

2. **Cohesion Engine → Brutal Honesty**
   - Validates assessments
   - Enhances content
   - Scores quality

3. **Ralph → Both Systems**
   - Tracks iterations
   - Manages stages
   - Detects completion

### MCP Server Integration

All integrations can leverage the configured MCP servers:

- **Vercel MCP**: Deployment integration
- **Stripe MCP**: Payment processing
- **Neon/Supabase MCP**: Database operations
- **Playwright MCP**: Test automation
- **Next.js DevTools MCP**: Debug tooling

---

## Related Documentation

### Claude Integration
- [Agent Quick Start Guide](./AGENTS.md)
- [MCP Setup Guide](../mcp/MCP_SETUP.md)
- [Project Architecture](../architecture/UNIFIED_BACKEND_ARCHITECTURE.md)

### Ralph Integration
- `RALPH_COHESION_ENGINE_RESEARCH.md` - Research and design
- `COHESION.md` - Cohesion engine documentation
- `STATUS.md` - Implementation status

### Brutal Honesty
- `scripts/cohesion/utils/brutal-honesty.ts` - Implementation
- `BRUTAL_RALPH_COHESION_ASSESSMENT.md` - Example brutal assessment
- `DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md` - Generated assessment (validated)

**Last Updated**: January 2026
