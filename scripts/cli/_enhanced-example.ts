#!/usr/bin/env tsx
/**
 * Enhanced CLI Example
 *
 * Demonstrates how to use EnhancedCLI with all integrated features:
 * - Pre-execution validation
 * - Automatic snapshots
 * - Execution logging
 * - Dry-run mode
 * - Impact analysis
 * - Auto-rollback on failure
 *
 * This is a reference implementation showing best practices.
 *
 * Usage:
 *   pnpm tsx scripts/cli/_enhanced-example.ts process --dry-run
 *   pnpm tsx scripts/cli/_enhanced-example.ts process --verbose
 *   pnpm tsx scripts/cli/_enhanced-example.ts status
 */

import { EnhancedCLI, runEnhancedCLI } from './_base-enhanced.js'
import type { CommandDefinition } from './_base.js'

/**
 * Example enhanced CLI script
 */
class EnhancedExampleCLI extends EnhancedCLI {
  name = 'enhanced-example'
  description = 'Example script demonstrating EnhancedCLI features'

  // Enable all features for demonstration
  protected enableValidation = true
  protected enableSnapshots = true
  protected enableLogging = true
  protected enableDryRun = true
  protected enableImpactAnalysis = true
  protected autoRollbackOnFailure = false

  // Configure validation
  protected validationOptions = {
    checks: ['env', 'git', 'disk'] as const,
    requiredEnvVars: [], // Add required env vars here
    minDiskSpace: 100 * 1024 * 1024, // 100MB minimum
  }

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'process',
        description: 'Process files with automatic validation and snapshots',
        handler: async () => this.processFiles(),
        args: [
          {
            name: 'input',
            short: 'i',
            type: 'string',
            description: 'Input file pattern',
          },
          {
            name: 'output',
            short: 'o',
            type: 'string',
            description: 'Output directory',
          },
        ],
      },
      {
        name: 'cleanup',
        description: 'Clean up temporary files',
        handler: async () => this.cleanup(),
        confirmPrompt: 'This will delete temporary files. Continue?',
      },
      {
        name: 'status',
        description: 'Show status information',
        handler: async () => this.showStatus(),
      },
    ]
  }

  /**
   * Process files (example operation)
   */
  private async processFiles() {
    const input = this.getFlag<string>('input', '*.txt')
    const output = this.getFlag<string>('output', 'output/')

    this.output.progress(`Processing files: ${input} → ${output}`)

    // Example: Write files using dry-run engine
    // In dry-run mode, these operations are recorded but not executed
    await this.dryRun.fs.mkdir(output, true)
    await this.dryRun.fs.writeFile(
      `${output}/processed-1.txt`,
      'Processed content 1'
    )
    await this.dryRun.fs.writeFile(
      `${output}/processed-2.txt`,
      'Processed content 2'
    )

    // Example: Database operations (if needed)
    // await this.dryRun.db.query('INSERT INTO logs VALUES (...)')

    // Example: External commands
    // await this.dryRun.exec('npm install')

    if (this.isDryRun()) {
      // In dry-run mode, impact analysis is shown automatically
      return this.output.success({
        message: 'Dry-run completed - review changes above',
        changes: this.dryRun.getChanges().length,
      })
    }

    return this.output.success({
      message: 'Files processed successfully',
      input,
      output,
      filesProcessed: 2,
    })
  }

  /**
   * Clean up temporary files
   */
  private async cleanup() {
    this.output.progress('Cleaning up temporary files...')

    // Example cleanup operations
    await this.dryRun.fs.deleteFile('temp-1.txt')
    await this.dryRun.fs.deleteFile('temp-2.txt')
    await this.dryRun.fs.rmdir('temp/', true)

    const changes = this.dryRun.getChanges()

    return this.output.success({
      message: 'Cleanup completed',
      filesDeleted: changes.filter(c => c.type === 'file-delete').length,
    })
  }

  /**
   * Show status
   */
  private async showStatus() {
    const executionId = this.getExecutionId()
    const snapshotId = this.getSnapshotId()
    const isDryRun = this.isDryRun()

    return this.output.success({
      message: 'Status information',
      script: this.name,
      executionId,
      snapshotId,
      isDryRun,
      features: {
        validation: this.enableValidation,
        snapshots: this.enableSnapshots,
        logging: this.enableLogging,
        dryRun: this.enableDryRun,
        impactAnalysis: this.enableImpactAnalysis,
        autoRollback: this.autoRollbackOnFailure,
      },
    })
  }
}

// Run CLI
runEnhancedCLI(EnhancedExampleCLI)
