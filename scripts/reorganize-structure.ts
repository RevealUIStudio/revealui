#!/usr/bin/env tsx

/**
 * RevealUI Codebase Structure Reorganization Script
 *
 * This script safely reorganizes the codebase structure according to the
 * architectural principles outlined in the deep structure analysis.
 *
 * Key reorganizations:
 * - Centralize all configuration under config/
 * - Simplify docs/ structure and naming
 * - Streamline scripts/ organization
 * - Standardize package structures
 * - Clean up root-level files
 */

import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

interface ReorganizationPlan {
  moves: Array<{
    from: string
    to: string
    description: string
  }>
  creates: Array<{
    path: string
    content: string
    description: string
  }>
  removes: string[]
}

// Define the reorganization plan based on the analysis
const REORGANIZATION_PLAN: ReorganizationPlan = {
  moves: [
    // Configuration centralization
    {
      from: 'config/turbo.json',
      to: 'config/build/turbo.json',
      description: 'Move turbo config to centralized build config',
    },
    {
      from: '.vscode-recommended.json',
      to: 'config/ide/vscode-recommended.json',
      description: 'Move VSCode config to centralized IDE config',
    },
    {
      from: 'performance.budgets.json',
      to: 'config/performance/budgets.json',
      description: 'Move performance config to centralized location',
    },
    {
      from: 'docs-lifecycle.config.json',
      to: 'config/docs/lifecycle.json',
      description: 'Move docs config to centralized location',
    },

    // Tool configurations
    {
      from: '.changeset/',
      to: 'config/ci/changeset/',
      description: 'Move changeset config to CI config',
    },
    {
      from: '.cursor/',
      to: 'config/ide/cursor/',
      description: 'Move Cursor config to IDE config',
    },
    {
      from: '.github/',
      to: 'config/ci/github/',
      description: 'Move GitHub config to CI config',
    },
    {
      from: '.husky/',
      to: 'config/hooks/husky/',
      description: 'Move Husky config to hooks config',
    },
    {
      from: '.mcp/',
      to: 'config/ide/mcp/',
      description: 'Move MCP config to IDE config',
    },

    // Documentation simplification
    {
      from: 'docs/analyses/',
      to: 'docs/development/analyses/',
      description: 'Move analyses to development docs',
    },
    {
      from: 'docs/plans/',
      to: 'docs/development/plans/',
      description: 'Move plans to development docs',
    },
    {
      from: 'docs/implementations/',
      to: 'docs/development/implementations/',
      description: 'Move implementations to development docs',
    },
    {
      from: 'docs/reviews/',
      to: 'docs/development/reviews/',
      description: 'Move reviews to development docs',
    },
    {
      from: 'docs/archives/',
      to: 'docs/archive/',
      description: 'Simplify archives location',
    },

    // Scripts reorganization
    {
      from: 'scripts/audit/',
      to: 'scripts/analysis/',
      description: 'Rename audit to analysis for clarity',
    },
    {
      from: 'scripts/consolidate-docs.ts',
      to: 'scripts/docs/consolidate.ts',
      description: 'Move docs scripts to dedicated folder',
    },
    {
      from: 'scripts/verify-claims.ts',
      to: 'scripts/docs/verify-claims.ts',
      description: 'Move docs scripts to dedicated folder',
    },
  ],
  creates: [
    {
      path: 'config/README.md',
      content:
        '# Configuration\n\nCentralized configuration for all RevealUI tools and processes.\n\n## Structure\n\n- `build/` - Build system configuration (turbo, etc.)\n- `ci/` - Continuous integration (GitHub Actions, Changesets)\n- `ide/` - IDE-specific configurations (VSCode, Cursor, MCP)\n- `hooks/` - Git hooks (Husky)\n- `docs/` - Documentation system configuration\n- `performance/` - Performance budgets and monitoring\n- `project/` - Core project configuration',
      description: 'Create centralized config README',
    },
    {
      path: 'docs/README.md',
      content:
        '# Documentation\n\n## Quick Start\n\n- [Guides](guides/) - User guides and tutorials\n- [Reference](reference/) - API documentation\n- [Development](development/) - Process and standards\n- [Archive](archive/) - Historical documentation\n\n## File Organization\n\nAll documentation uses simple, descriptive names without complex date prefixes.',
      description: 'Create simplified docs README',
    },
    {
      path: 'scripts/README.md',
      content:
        '# Scripts\n\n## Categories\n\n- `build/` - Build and deployment scripts\n- `dev/` - Development tools\n- `analysis/` - Code analysis and auditing\n- `database/` - Database management\n- `docs/` - Documentation tools\n- `validation/` - Code quality checks\n- `utils/` - Shared utilities',
      description: 'Create scripts organization README',
    },
  ],
  removes: [
    'automation-component-audit.json',
    'validation-report.json',
    'validation-fix-scripts.json',
    'simple-test.mjs',
    'test-script.js',
    'PERFORMANCE_BUDGET_TUNING_README.md',
    'PERFORMANCE_CALIBRATION_GUIDE.md',
  ],
}

class StructureReorganizer {
  private dryRun: boolean = true

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun
  }

  async reorganize(): Promise<void> {
    console.log('🔄 Starting RevealUI Structure Reorganization\n')

    // Create new directories
    await this.createDirectories()

    // Move files and directories
    await this.moveItems()

    // Create new files
    await this.createFiles()

    // Remove obsolete files
    await this.removeFiles()

    // Update references
    await this.updateReferences()

    console.log('\n✅ Structure reorganization completed!')
    console.log('\n📋 Next Steps:')
    console.log('1. Review all moved files for correctness')
    console.log('2. Update any broken imports/references')
    console.log('3. Run validation: pnpm typecheck:all && pnpm lint && pnpm test')
    console.log('4. Commit changes in logical chunks')
  }

  private async createDirectories(): Promise<void> {
    console.log('📁 Creating new directory structure...')

    const directories = [
      'config/build',
      'config/ci',
      'config/ide',
      'config/hooks',
      'config/docs',
      'config/performance',
      'packages/config/src',
      'docs/guides',
      'docs/development',
      'docs/archive',
      'scripts/docs',
      'scripts/dev',
      'scripts/analysis',
    ]

    for (const dir of directories) {
      if (!this.dryRun) {
        mkdirSync(dir, { recursive: true })
      }
      console.log(`  ${this.dryRun ? '[DRY RUN] ' : ''}Created: ${dir}/`)
    }
  }

  private async moveItems(): Promise<void> {
    console.log('\n📦 Moving files and directories...')

    for (const move of REORGANIZATION_PLAN.moves) {
      if (existsSync(move.from)) {
        if (!this.dryRun) {
          // Ensure destination directory exists
          const destDir = dirname(move.to)
          mkdirSync(destDir, { recursive: true })

          // Handle directory merge conflicts
          if (
            existsSync(move.to) &&
            statSync(move.from).isDirectory() &&
            statSync(move.to).isDirectory()
          ) {
            console.log(`  🔄 Merging directories: ${move.from} → ${move.to}`)
            await this.mergeDirectories(move.from, move.to)
            // Remove the source directory after merging
            rmSync(move.from, { recursive: true, force: true })
          } else {
            // Move the item
            renameSync(move.from, move.to)
          }
        }
        console.log(`  ${this.dryRun ? '[DRY RUN] ' : ''}Moved: ${move.from} → ${move.to}`)
        console.log(`    ${move.description}`)
      } else {
        console.log(`  ⚠️  Source not found: ${move.from}`)
      }
    }
  }

  private async mergeDirectories(source: string, destination: string): Promise<void> {
    const items = readdirSync(source)

    for (const item of items) {
      const sourcePath = join(source, item)
      const destPath = join(destination, item)

      if (statSync(sourcePath).isDirectory()) {
        if (!existsSync(destPath)) {
          mkdirSync(destPath, { recursive: true })
        }
        await this.mergeDirectories(sourcePath, destPath)
      } else {
        // For files, just move them (overwrite if exists)
        renameSync(sourcePath, destPath)
      }
    }
  }

  private async createFiles(): Promise<void> {
    console.log('\n📝 Creating new files...')

    for (const create of REORGANIZATION_PLAN.creates) {
      if (!this.dryRun) {
        // Ensure directory exists
        const dir = dirname(create.path)
        mkdirSync(dir, { recursive: true })

        // Create file
        writeFileSync(create.path, create.content, 'utf-8')
      }
      console.log(`  ${this.dryRun ? '[DRY RUN] ' : ''}Created: ${create.path}`)
      console.log(`    ${create.description}`)
    }
  }

  private async removeFiles(): Promise<void> {
    console.log('\n🗑️  Removing obsolete files...')

    for (const remove of REORGANIZATION_PLAN.removes) {
      if (existsSync(remove)) {
        if (!this.dryRun) {
          rmSync(remove, { recursive: true, force: true })
        }
        console.log(`  ${this.dryRun ? '[DRY RUN] ' : ''}Removed: ${remove}`)
      } else {
        console.log(`  ⚠️  File not found: ${remove}`)
      }
    }
  }

  private async updateReferences(): Promise<void> {
    console.log('\n🔗 Updating configuration references...')

    // Update package.json scripts that reference moved files
    const packageJsonPath = 'package.json'
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const scripts = packageJson.scripts || {}

      // Update script references
      const updates: Record<string, string> = {
        'audit:docs': 'tsx scripts/docs/verify-claims.ts',
        'verify:docs': 'tsx scripts/docs/verify-claims.ts',
        'consolidate:docs': 'tsx scripts/docs/consolidate.ts',
        'analysis:audit': 'tsx scripts/analysis/audit.ts',
      }

      let updated = false
      for (const [key, newValue] of Object.entries(updates)) {
        if (scripts[key]) {
          if (!this.dryRun) {
            scripts[key] = newValue
          }
          console.log(`  ${this.dryRun ? '[DRY RUN] ' : ''}Updated script: ${key} → ${newValue}`)
          updated = true
        }
      }

      if (updated && !this.dryRun) {
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
      }
    }

    // Update revealui.config.ts to point to new config locations
    const configPath = 'packages/config/src/revealui.config.ts'
    const oldConfigPath = 'revealui.config.ts'
    if (existsSync(oldConfigPath) && !this.dryRun) {
      renameSync(oldConfigPath, configPath)
      console.log(`  Moved main config: ${oldConfigPath} → ${configPath}`)
    }
  }

  async validate(): Promise<void> {
    console.log('\n🔍 Validating reorganization...')

    // Check that all expected directories exist
    const expectedDirs = [
      'config',
      'config/build',
      'config/ci',
      'config/ide',
      'config/hooks',
      'config/docs',
      'config/performance',
      'packages/config/src',
      'docs/development',
      'docs/archive',
      'scripts/docs',
    ]

    for (const dir of expectedDirs) {
      if (existsSync(dir)) {
        console.log(`  ✅ Directory exists: ${dir}/`)
      } else {
        console.log(`  ❌ Missing directory: ${dir}/`)
      }
    }

    // Check that critical files are in place
    const criticalFiles = ['config/README.md', 'docs/README.md', 'scripts/README.md']

    for (const file of criticalFiles) {
      if (existsSync(file)) {
        console.log(`  ✅ File exists: ${file}`)
      } else {
        console.log(`  ❌ Missing file: ${file}`)
      }
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--apply')

  console.log('🎯 RevealUI Codebase Structure Reorganization')
  console.log('='.repeat(50))

  if (dryRun) {
    console.log('🚨 DRY RUN MODE - No changes will be made')
    console.log('Run with --apply to execute the reorganization')
  } else {
    console.log('⚠️  LIVE MODE - Changes will be applied')
    console.log('Make sure you have committed all current changes first!')
  }

  console.log('')

  const reorganizer = new StructureReorganizer(dryRun)

  try {
    await reorganizer.reorganize()
    await reorganizer.validate()

    if (dryRun) {
      console.log('\n💡 To apply these changes, run:')
      console.log('pnpm dlx tsx scripts/reorganize-structure.ts --apply')
    }
  } catch (error) {
    console.error('\n❌ Reorganization failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { StructureReorganizer, REORGANIZATION_PLAN }
