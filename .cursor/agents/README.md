# Cursor IDE Agents

This folder contains custom AI agents for specific tasks in the RevealUI Framework.

## Available Agents

Agents can be referenced in Cursor IDE to perform specific tasks or follow particular workflows.

- **nextjs.md** - Next.js 16 specific patterns and routes
- **nextjs-error-analyzer.md** - Capture and analyze browser console errors using MCP (⚠️ Experimental)
- **cms.md** - RevealUI CMS collections, hooks, and access control patterns
- **typescript.md** - TypeScript type checking and fixes
- **testing.md** - Writing and running tests

## Usage

To use an agent, reference it in your Cursor chat:
- "Use the CMS agent to help with..."
- "Run the TypeScript agent to..."
- "Apply the testing agent for..."

## Creating New Agents

Create a new agent by adding a markdown file in this directory with:
- Agent name and description
- Specific rules and patterns to follow
- Examples of tasks it should handle
- Context about when to use it
