#!/usr/bin/env node
/**
 * Workflow Runner - Orchestrates Automation Workflows
 *
 * Manages workflow execution with real human checkpoints and state persistence.
 * Provides CLI interface for running automation workflows.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AutomationEngine, type WorkflowStep } from './typed/automation-engine.ts'
import { ErrorCode } from '../lib/errors.js'

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
}

class WorkflowRunner {
  private templates: Map<string, WorkflowTemplate> = new Map()

  constructor() {
    this.loadTemplates()
  }

  async runWorkflow(templateId: string, task: string): Promise<boolean> {
    const template = this.templates.get(templateId)
    if (!template) {
      console.log(`❌ Workflow template not found: ${templateId}`)
      console.log('Available templates:', Array.from(this.templates.keys()))
      return false
    }

    console.log(`🚀 Starting workflow: ${template.name}`)
    console.log(`Description: ${template.description}`)
    console.log(`Task: ${task}\n`)

    const engine = new AutomationEngine(task, `${templateId}-${Date.now()}`)
    engine.defineWorkflow(template.steps)

    return await engine.execute()
  }

  async resumeWorkflow(workflowId: string): Promise<boolean> {
    const stateFile = join(process.cwd(), `automation-${workflowId}.json`)

    if (!existsSync(stateFile)) {
      console.log(`❌ Workflow state not found: ${workflowId}`)
      return false
    }

    console.log(`🔄 Resuming workflow: ${workflowId}`)

    const engine = new AutomationEngine('', workflowId)
    return await engine.resume()
  }

  async checkApprovals(): Promise<void> {
    const approvalFiles = readdirSync(process.cwd()).filter(
      (file) => file.startsWith('approval-') && file.endsWith('.txt'),
    )

    if (approvalFiles.length === 0) {
      console.log('✅ No pending approvals')
      return
    }

    console.log('📋 Pending Approvals:')
    for (const file of approvalFiles) {
      console.log(`  • ${file}`)
    }

    console.log(
      '\n💡 To approve, edit the file and change the response, then run the workflow again.',
    )
  }

  async listWorkflows(): Promise<void> {
    console.log('📋 Available Workflow Templates:')
    console.log('================================\n')

    for (const [id, template] of this.templates) {
      console.log(`${id}:`)
      console.log(`  Name: ${template.name}`)
      console.log(`  Description: ${template.description}`)
      console.log(`  Steps: ${template.steps.length}`)
      console.log('')
    }
  }

  async listRunningWorkflows(): Promise<void> {
    const stateFiles = readdirSync(process.cwd()).filter(
      (file) => file.startsWith('automation-') && file.endsWith('.json'),
    )

    if (stateFiles.length === 0) {
      console.log('✅ No running workflows')
      return
    }

    console.log('🔄 Running Workflows:')
    console.log('====================\n')

    for (const file of stateFiles) {
      try {
        const state = JSON.parse(readFileSync(file, 'utf8'))
        console.log(`${state.id}:`)
        console.log(`  Task: ${state.task}`)
        console.log(`  Status: ${state.status}`)
        console.log(`  Progress: ${state.completedSteps.length}/${state.steps.length} steps`)
        console.log(`  Current: ${state.steps[state.currentStepIndex]?.name || 'N/A'}`)
        if (state.reason) {
          console.log(`  Reason: ${state.reason}`)
        }
        console.log('')
      } catch (_error) {
        console.log(`${file}: Error reading state`)
      }
    }
  }

  private loadTemplates(): void {
    // Define built-in workflow templates
    this.templates.set('automation-infrastructure', {
      id: 'automation-infrastructure',
      name: 'Build Automation Infrastructure',
      description: 'Systematic approach to build real automation infrastructure',
      steps: [
        {
          id: 'component-audit',
          name: 'Component Audit',
          description: 'Audit all components to identify working vs broken systems',
          script: 'scripts/component-audit.ts',
          requiresApproval: false,
          validation: ['component-audit'],
        },
        {
          id: 'validation-fixes',
          name: 'Fix Validation Issues',
          description: 'Fix TypeScript, linting, and test validation failures',
          script: 'scripts/fix-validation-issues.ts',
          requiresApproval: true,
          validation: ['typecheck', 'lint'],
        },
        {
          id: 'automation-engine',
          name: 'Build Automation Engine',
          description: 'Create scripts/automation-engine.ts for real workflow execution',
          command: 'echo "Automation engine requirements defined"',
          requiresApproval: false,
        },
        {
          id: 'workflow-runner',
          name: 'Build Workflow Runner',
          description: 'Create scripts/workflow-runner.ts for orchestration',
          command: 'echo "Workflow runner requirements defined"',
          requiresApproval: false,
        },
        {
          id: 'file-manager',
          name: 'Build File Manager',
          description: 'Create scripts/file-manager.ts for automated file lifecycle',
          command: 'echo "File manager requirements defined"',
          requiresApproval: false,
        },
        {
          id: 'review-system',
          name: 'Build Review System',
          description: 'Create scripts/review-generator.ts for generation reviews',
          command: 'echo "Review system requirements defined"',
          requiresApproval: false,
        },
        {
          id: 'archive-system',
          name: 'Build Archive System',
          description: 'Create scripts/archive-manager.ts for project archiving',
          command: 'echo "Archive system requirements defined"',
          requiresApproval: false,
        },
        {
          id: 'final-validation',
          name: 'Final Validation',
          description: 'Run complete validation to confirm automation infrastructure works',
          requiresApproval: false,
          validation: ['typecheck', 'lint', 'test'],
        },
      ],
    })

    this.templates.set('validation-cleanup', {
      id: 'validation-cleanup',
      name: 'Validation Cleanup',
      description: 'Fix all validation issues blocking automation development',
      steps: [
        {
          id: 'audit-validation-issues',
          name: 'Audit Validation Issues',
          description: 'Identify all TypeScript, linting, and test failures',
          command: 'pnpm run enforce:validation',
          requiresApproval: false,
        },
        {
          id: 'fix-typescript-config',
          name: 'Fix TypeScript Configuration',
          description: 'Update tsconfig.json files to resolve exactOptionalPropertyTypes issues',
          script: 'scripts/fix-validation-issues.ts',
          requiresApproval: false,
        },
        {
          id: 'fix-linting-issues',
          name: 'Fix Linting Issues',
          description: 'Remove incorrect biome suppressions and fix code style issues',
          requiresApproval: false,
        },
        {
          id: 'validate-fixes',
          name: 'Validate Fixes',
          description: 'Run validation to confirm fixes work',
          validation: ['typecheck', 'lint'],
          requiresApproval: false,
        },
      ],
    })
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const runner = new WorkflowRunner()

  if (args.length === 0) {
    console.log('Workflow Runner - Orchestrates automation workflows')
    console.log('=================================================\n')
    console.log('Commands:')
    console.log('  list                    - List available workflow templates')
    console.log('  running                 - List running workflows')
    console.log('  approvals               - Check pending approvals')
    console.log('  run <template> <task>   - Run a workflow template')
    console.log('  resume <workflow-id>    - Resume a paused workflow')
    console.log('\nExamples:')
    console.log('  workflow-runner run automation-infrastructure "Build real automation"')
    console.log('  workflow-runner resume workflow-1234567890')
    return
  }

  const command = args[0]

  switch (command) {
    case 'list':
      await runner.listWorkflows()
      break

    case 'running':
      await runner.listRunningWorkflows()
      break

    case 'approvals':
      await runner.checkApprovals()
      break

    case 'run': {
      if (args.length < 3) {
        console.log('❌ Error: run requires template and task')
        console.log('Usage: workflow-runner run <template> <task>')
        process.exit(ErrorCode.CONFIG_ERROR)
      }
      const templateId = args[1]
      const task = args.slice(2).join(' ')
      const success = await runner.runWorkflow(templateId, task)
      if (!success) {
        process.exit(ErrorCode.CONFIG_ERROR)
      }
      break
    }

    case 'resume': {
      if (args.length < 2) {
        console.log('❌ Error: resume requires workflow ID')
        console.log('Usage: workflow-runner resume <workflow-id>')
        process.exit(ErrorCode.CONFIG_ERROR)
      }
      const workflowId = args[1]
      const resumeSuccess = await runner.resumeWorkflow(workflowId)
      if (!resumeSuccess) {
        process.exit(ErrorCode.CONFIG_ERROR)
      }
      break
    }

    default:
      console.log(`❌ Unknown command: ${command}`)
      process.exit(ErrorCode.CONFIG_ERROR)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { WorkflowRunner }
