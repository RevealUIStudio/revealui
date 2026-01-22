# RevealUI Commands

This directory contains Cursor commands for the RevealUI framework.

## Available Commands

### `development-prompt`

Complete development prompt template for RevealUI framework tasks with full context, requirements, constraints, and lifecycle management.

#### Usage

Type `/development-prompt` in Cursor's AI chat to insert the comprehensive development prompt template.

#### Features

- **🎯 Phase-based development** for iterative workflows
- **📋 Complete context** with project overview, current state, and git status
- **🔧 Implementation specifics** with RevealUI coding patterns and constraints
- **🚫 Anti-pattern enforcement** including forbidden GraphQL, CommonJS, etc.
- **🧪 Validation requirements** with testing and verification steps
- **🔄 Lifecycle management** for continuous development phases

#### Template Sections

1. **Task Context**: Project overview, current files, git status
2. **Task Specification**: Objectives, requirements, acceptance criteria
3. **Implementation Details**: Code patterns, files to modify, signatures
4. **Constraints**: Forbidden patterns and required patterns
5. **Validation**: Testing and verification steps
6. **Development Lifecycle**: Phase management and next steps
7. **Reference**: Related files, patterns, documentation
8. **Success Criteria**: Completion metrics and definition of done

---

### `test-implementation`

Specialized prompt template for implementing tests with proper structure, mocking, and validation patterns.

#### Usage

Type `/test-implementation` in Cursor's AI chat for test development tasks.

#### Features

- **🧪 Test structure templates** with Arrange-Act-Assert pattern
- **🎯 Coverage goals** and test case specifications
- **🔧 Testing patterns** for Vitest, React Testing Library, Playwright
- **🚫 Testing constraints** and anti-patterns
- **🧪 Validation steps** with coverage and performance metrics

---

### `code-review`

Comprehensive code review template with quality gates, security checks, and actionable feedback.

#### Usage

Type `/code-review` in Cursor's AI chat for code review and refactoring tasks.

#### Features

- **🔍 Review checklists** for code quality, architecture, security, performance
- **🚫 Issue categorization** (Critical/Major/Minor fixes required)
- **💡 Improvement suggestions** with actionable recommendations
- **🧪 Testing verification** and coverage analysis
- **🎯 Clear approval criteria** and next steps

---

### `debug-issue`

Systematic debugging template for identifying, fixing, and preventing software issues.

#### Usage

Type `/debug-issue` in Cursor's AI chat for debugging runtime errors, build failures, or unexpected behavior.

#### Features

- **🐛 Structured debugging methodology** with investigation steps
- **🎯 Root cause analysis** and hypothesis testing
- **🔧 Debug tools guidance** for browser, React, and development tools
- **🚫 Common debugging anti-patterns** to avoid
- **🧪 Validation procedures** and regression testing

---

### `revealui:scaffold-page`

Scaffold a new RevealUI page with MCP integrations and visual development features.

#### Usage

```bash
# Interactive mode
pnpm scaffold:page

# With arguments
pnpm scaffold:page --name="Dashboard" --route="/dashboard" --template=dashboard --no-mcp
```

#### Options

- `--name=<string>`: Page name (e.g., "Dashboard")
- `--route=<string>`: Route path (e.g., "/dashboard")
- `--template=<string>`: Template type (landing|dashboard|profile|settings) - defaults to "landing"
- `--no-mcp`: Disable MCP features (Vercel/Stripe integrations)

#### Examples

```bash
# Create a landing page
pnpm scaffold:page --name="Home" --route="/"

# Create a dashboard with MCP features
pnpm scaffold:page --name="Analytics" --route="/analytics" --template=dashboard

# Create a profile page without MCP
pnpm scaffold:page --name="Profile" --route="/profile" --template=profile --no-mcp
```

#### Features

- **Visual Templates**: Choose from landing page, dashboard, profile, or settings templates
- **MCP Integration**: Automatically include Vercel deployment and Stripe payment features
- **Type Generation**: Creates TypeScript types and interfaces following project conventions
- **Clean Architecture**: Follows RevealUI's domain/application/infrastructure layer structure
- **Modern UI**: Uses Tailwind CSS with RevealUI's design system

#### Generated Files

- `apps/web/src/app/{route}/page.tsx` - The main page component
- `apps/web/src/lib/types/{route}.ts` - TypeScript types and interfaces (when MCP enabled)

#### Templates

1. **Landing Page**: Hero section with feature cards and MCP demo
2. **Dashboard**: Analytics cards with metrics and MCP integrations
3. **Profile**: User profile form with payment settings
4. **Settings**: Configuration options with integration settings

---

## Ralph Iterative Workflow

The Ralph iterative workflow is a manual iteration system for complex tasks. See the [workflow documentation](../workflows/ralph-iterative-workflow.md) for detailed usage.

### Available Commands

- `pnpm ralph:start` - Start a new iterative workflow
- `pnpm ralph:status` - Check current workflow status
- `pnpm ralph:continue` - Continue to next iteration
- `pnpm ralph:cancel` - Cancel active workflow

### Quick Start

```bash
# Start a workflow
pnpm ralph:start "Build REST API" --completion-promise "DONE" --max-iterations 20

# Check status
pnpm ralph:status

# Continue iteration
pnpm ralph:continue

# When complete, create marker and continue
echo "DONE" > .cursor/ralph-complete.marker
pnpm ralph:continue

# Cancel anytime
pnpm ralph:cancel
```

**Note**: This is a **manual iterative workflow**, not an autonomous loop. You must re-invoke commands to continue iterations.
