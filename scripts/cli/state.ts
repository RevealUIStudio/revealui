#!/usr/bin/env tsx

/**
 * State CLI
 *
 * Consolidated CLI for state and workflow management.
 * Replaces: workflow.ts, registry.ts, profile.ts
 *
 * Commands:
 *   workflow:start    Start a workflow
 *   workflow:status   Check workflow status
 *   workflow:list     List all workflows
 *   workflow:cancel   Cancel a workflow
 *   workflow:resume   Resume a workflow
 *   registry:list     List registry entries
 *   registry:add      Add registry entry
 *   registry:remove   Remove registry entry
 *   registry:update   Update registry entry
 *   profile           Show profile information
 *   profile:set       Set profile value
 *   profile:export    Export profile
 *
 * Usage:
 *   pnpm state <command> [options]
 *   pnpm state workflow:start build-and-test
 *   pnpm state registry:list --verbose
 *   pnpm state profile --json
 *
 * @dependencies
 * - scripts/cli/_base.ts - Base CLI classes (DispatcherCLI, runCLI)
 * - scripts/lib/args.ts - Argument parsing types (ParsedArgs)
 * - scripts/lib/audit/execution-logger.ts - Execution tracking (via base class)
 * - scripts/lib/cli/dispatch.ts - Command dispatching utilities
 * - scripts/workflow/* - Workflow management commands
 * - scripts/registry/* - Registry operation commands
 * - scripts/profile/* - Profile management commands
 *
 * @requires
 * - Scripts: Individual command scripts in commandMap (dispatched at runtime)
 */

import { type CommandDefinition, DispatcherCLI, runCLI } from './_base.js'

class StateCLI extends DispatcherCLI {
  name = 'state'
  description = 'State and workflow management'
  protected enableExecutionLogging = true

  protected commandMap = {
    // Workflow commands (from workflow.ts)
    'workflow:start': 'scripts/workflow/start-workflow.ts',
    'workflow:status': 'scripts/workflow/workflow-status.ts',
    'workflow:list': 'scripts/workflow/list-workflows.ts',
    'workflow:cancel': 'scripts/workflow/cancel-workflow.ts',
    'workflow:resume': 'scripts/workflow/resume-workflow.ts',

    // Registry commands (from registry.ts)
    'registry:list': 'scripts/registry/list-entries.ts',
    'registry:add': 'scripts/registry/add-entry.ts',
    'registry:remove': 'scripts/registry/remove-entry.ts',
    'registry:update': 'scripts/registry/update-entry.ts',

    // Profile commands (from profile.ts)
    profile: 'scripts/commands/profile/show-profile.ts',
    'profile:set': 'scripts/commands/profile/set-profile.ts',
    'profile:export': 'scripts/commands/profile/export-profile.ts',
  }

  defineGlobalArgs() {
    return [
      ...super.defineGlobalArgs(),
      {
        name: 'id',
        type: 'string' as const,
        description: 'Workflow or registry ID',
      },
    ]
  }

  defineCommands(): CommandDefinition[] {
    return [
      // Workflow Commands
      {
        name: 'workflow:start',
        description: 'Start a workflow',
        args: [
          {
            name: 'name',
            type: 'string' as const,
            required: true,
            description: 'Workflow name',
          },
          {
            name: 'background',
            type: 'boolean' as const,
            description: 'Run in background',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('workflow:start', args),
      },
      {
        name: 'workflow:status',
        description: 'Check workflow status',
        args: [
          {
            name: 'id',
            type: 'string' as const,
            required: true,
            description: 'Workflow ID',
          },
        ],
        handler: async (args) => this.dispatchCommand('workflow:status', args),
      },
      {
        name: 'workflow:list',
        description: 'List all workflows',
        args: [
          {
            name: 'status',
            type: 'string' as const,
            description: 'Filter by status (running, completed, failed)',
          },
          {
            name: 'limit',
            type: 'number' as const,
            description: 'Maximum number of workflows to list',
            default: 10,
          },
        ],
        handler: async (args) => this.dispatchCommand('workflow:list', args),
      },
      {
        name: 'workflow:cancel',
        description: 'Cancel a running workflow',
        args: [
          {
            name: 'id',
            type: 'string' as const,
            required: true,
            description: 'Workflow ID',
          },
        ],
        confirmPrompt: 'This will cancel the workflow. Continue?',
        handler: async (args) => this.dispatchCommand('workflow:cancel', args),
      },
      {
        name: 'workflow:resume',
        description: 'Resume a paused workflow',
        args: [
          {
            name: 'id',
            type: 'string' as const,
            required: true,
            description: 'Workflow ID',
          },
        ],
        handler: async (args) => this.dispatchCommand('workflow:resume', args),
      },

      // Registry Commands
      {
        name: 'registry:list',
        description: 'List registry entries',
        args: [
          {
            name: 'type',
            type: 'string' as const,
            description: 'Filter by entry type',
          },
        ],
        handler: async (args) => this.dispatchCommand('registry:list', args),
      },
      {
        name: 'registry:add',
        description: 'Add registry entry',
        args: [
          {
            name: 'key',
            type: 'string' as const,
            required: true,
            description: 'Entry key',
          },
          {
            name: 'value',
            type: 'string' as const,
            required: true,
            description: 'Entry value',
          },
          {
            name: 'type',
            type: 'string' as const,
            description: 'Entry type',
          },
        ],
        handler: async (args) => this.dispatchCommand('registry:add', args),
      },
      {
        name: 'registry:remove',
        description: 'Remove registry entry',
        args: [
          {
            name: 'key',
            type: 'string' as const,
            required: true,
            description: 'Entry key',
          },
        ],
        confirmPrompt: 'This will remove the entry. Continue?',
        handler: async (args) => this.dispatchCommand('registry:remove', args),
      },
      {
        name: 'registry:update',
        description: 'Update registry entry',
        args: [
          {
            name: 'key',
            type: 'string' as const,
            required: true,
            description: 'Entry key',
          },
          {
            name: 'value',
            type: 'string' as const,
            required: true,
            description: 'New value',
          },
        ],
        handler: async (args) => this.dispatchCommand('registry:update', args),
      },

      // Profile Commands
      {
        name: 'profile',
        description: 'Show profile information',
        args: [
          {
            name: 'detailed',
            type: 'boolean' as const,
            description: 'Show detailed profile',
            default: false,
          },
        ],
        handler: async (args) => this.dispatchCommand('profile', args),
      },
      {
        name: 'profile:set',
        description: 'Set profile value',
        args: [
          {
            name: 'key',
            type: 'string' as const,
            required: true,
            description: 'Profile key',
          },
          {
            name: 'value',
            type: 'string' as const,
            required: true,
            description: 'Profile value',
          },
        ],
        handler: async (args) => this.dispatchCommand('profile:set', args),
      },
      {
        name: 'profile:export',
        description: 'Export profile to file',
        args: [
          {
            name: 'output',
            type: 'string' as const,
            description: 'Output file path',
          },
          {
            name: 'format',
            type: 'string' as const,
            description: 'Export format (json, yaml)',
            default: 'json',
          },
        ],
        handler: async (args) => this.dispatchCommand('profile:export', args),
      },
    ]
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(StateCLI).catch(console.error)
}

export { StateCLI }
