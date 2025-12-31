# Cursor IDE Configuration

This folder contains configuration files for Cursor IDE to help with AI-assisted development.

## Files

- **`rules.md`** - Detailed project rules and conventions
- **`config.json`** - Cursor IDE configuration with file patterns and context
- **`agents/`** - Specialized AI agents for specific tasks (PayloadCMS, TypeScript, Testing, Next.js)
- **`workflows/`** - Step-by-step workflows for common development tasks
- **`snippets/`** - Reusable code snippets and templates
- **`.cursorrules`** (root) - Main rules file that Cursor reads automatically
- **`.cursorignore`** (root) - Files to exclude from AI context

## Environment Variables

Environment files (`.env*`) are excluded from git (via `.gitignore`) but are **included** in Cursor IDE context (not in `.cursorignore`). This allows the AI to see and understand your environment configuration for better assistance, while keeping sensitive values out of version control. Production values are generated securely in the CI/CD pipeline.

## Usage

Cursor IDE will automatically read:
- `.cursorrules` in the project root
- `.cursor/config.json` for additional configuration
- `.cursorignore` to exclude files from context

### Using Agents

Reference specialized agents in your Cursor chat:
- "Use the PayloadCMS agent to create a new collection"
- "Apply the TypeScript agent to fix type errors"
- "Use the testing agent to write unit tests"
- "Follow the Next.js agent for route handlers"

### Using Workflows

Follow step-by-step workflows:
- "Follow the new collection workflow"
- "Use the component creation workflow"

### Using Snippets

Reference code snippets:
- "Use the PayloadCMS collection snippet"
- "Apply the Next.js route handler snippet"

You can reference these files when asking Cursor for help with the project.

