#!/usr/bin/env tsx
/**
 * Version Management CLI
 *
 * Manages script versions, compatibility checks, and deprecation warnings.
 *
 * Usage:
 *   pnpm version register <script> <version>         Register new version
 *   pnpm version list [<script>]                     List versions
 *   pnpm version check <script> <version>            Check compatibility
 *   pnpm version deprecate <script> <feature>        Add deprecation
 *   pnpm version warnings <script>                   Show deprecation warnings
 *   pnpm version stats                               Show version statistics
 *
 * Examples:
 *   pnpm version register db 2.0.0 --description "Major update"
 *   pnpm version list db
 *   pnpm version check db 1.5.0
 *   pnpm version deprecate db legacyMigrate --version 2.0.0
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ErrorCode, ScriptError } from '../lib/errors.js'
import { type Deprecation, getDeprecationManager } from '../lib/versioning/deprecation-manager.js'
import { getVersionManager, type VersionInfo } from '../lib/versioning/script-version.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

// Get project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

/**
 * Version Management CLI
 */
class VersionCLI extends BaseCLI {
  name = 'version'
  description = 'Script version management and compatibility checking'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'register',
        description: 'Register a new script version (usage: version register <script> <version>)',
        handler: async () => this.register(),
        args: [
          {
            name: 'description',
            short: 'd',
            type: 'string',
            description: 'Version description',
          },
          {
            name: 'author',
            short: 'a',
            type: 'string',
            description: 'Version author',
          },
          {
            name: 'changelog',
            short: 'c',
            type: 'string',
            description: 'Changelog entries (comma-separated)',
          },
          {
            name: 'breaking',
            short: 'b',
            type: 'string',
            description: 'Breaking changes (comma-separated)',
          },
        ],
      },
      {
        name: 'list',
        description: 'List script versions (usage: version list [script])',
        handler: async () => this.list(),
        args: [],
      },
      {
        name: 'check',
        description: 'Check version compatibility (usage: version check <script> <version>)',
        handler: async () => this.check(),
        args: [],
      },
      {
        name: 'deprecate',
        description: 'Add deprecation notice (usage: version deprecate <script> <feature>)',
        handler: async () => this.deprecate(),
        args: [
          {
            name: 'version',
            short: 'v',
            type: 'string',
            description: 'Version when deprecated',
            required: true,
          },
          {
            name: 'reason',
            short: 'r',
            type: 'string',
            description: 'Deprecation reason',
          },
          {
            name: 'alternative',
            short: 'a',
            type: 'string',
            description: 'Alternative to use',
          },
          {
            name: 'removal',
            type: 'string',
            description: 'Version when feature will be removed',
          },
          {
            name: 'severity',
            short: 's',
            type: 'string',
            description: 'Severity: info, warning, error',
          },
        ],
      },
      {
        name: 'warnings',
        description: 'Show deprecation warnings (usage: version warnings <script>)',
        handler: async () => this.warnings(),
        args: [],
      },
      {
        name: 'stats',
        description: 'Show version statistics',
        handler: async () => this.stats(),
        args: [],
      },
    ]
  }

  /**
   * Register a new version
   */
  private async register() {
    const scriptName = this.requirePositional(0, 'script')
    const version = this.requirePositional(1, 'version')

    const description = this.getFlag('description', 'New version')
    const author = this.getFlag('author', process.env.USER || process.env.USERNAME || 'unknown')
    const changelogStr = this.getFlag('changelog', '')
    const breakingStr = this.getFlag('breaking', '')

    const changelog = changelogStr ? changelogStr.split(',').map((s) => s.trim()) : []
    const breakingChanges = breakingStr ? breakingStr.split(',').map((s) => s.trim()) : []

    const manager = await getVersionManager(PROJECT_ROOT)

    await manager.registerVersion({
      scriptName,
      version,
      description,
      releaseDate: new Date(),
      author,
      changelog,
      breakingChanges,
      requiredDependencies: {},
      deprecationNotice: null,
    })

    if (this.args.flags.json) {
      return this.output.success({
        message: 'Version registered',
        scriptName,
        version,
      })
    }

    this.output.success(`Registered ${scriptName} version ${version}`)
    if (changelog.length > 0) {
      console.log('\nChangelog:')
      for (const item of changelog) {
        console.log(`  - ${item}`)
      }
    }
    if (breakingChanges.length > 0) {
      console.log('\nBreaking changes:')
      for (const item of breakingChanges) {
        console.log(`  - ${item}`)
      }
    }

    return this.output.success({ scriptName, version })
  }

  /**
   * List versions
   */
  private async list() {
    const scriptName = this.getPositional(0)
    const manager = await getVersionManager(PROJECT_ROOT)

    const versions = scriptName
      ? await manager.getVersions(scriptName)
      : await manager.getAllVersions()

    if (this.args.flags.json) {
      return this.output.success({ versions })
    }

    if (versions.length === 0) {
      this.output.warn('No versions found')
      return this.output.success({ total: 0 })
    }

    console.log(`\nFound ${versions.length} version${versions.length === 1 ? '' : 's'}\n`)

    // Group by script if showing all
    if (!scriptName) {
      const grouped = versions.reduce(
        (acc, v) => {
          if (!acc[v.scriptName]) {
            acc[v.scriptName] = []
          }
          acc[v.scriptName].push(v)
          return acc
        },
        {} as Record<string, typeof versions>,
      )

      for (const [name, versionList] of Object.entries(grouped)) {
        console.log(`\n${name.toUpperCase()}`)
        console.log('─'.repeat(60))
        this.printVersionList(versionList)
      }
    } else {
      this.printVersionList(versions)
    }

    return this.output.success({ total: versions.length })
  }

  /**
   * Check compatibility
   */
  private async check() {
    const scriptName = this.requirePositional(0, 'script')
    const version = this.requirePositional(1, 'version')

    const manager = await getVersionManager(PROJECT_ROOT)
    const compat = await manager.checkCompatibility(scriptName, version)

    if (this.args.flags.json) {
      return this.output.success({ compatibility: compat })
    }

    console.log(`\nCompatibility Check: ${scriptName} v${version}\n`)
    console.log('─'.repeat(60))

    const statusIcon = compat.compatible ? '✓' : '✗'
    const statusColor = compat.compatible ? '\x1b[32m' : '\x1b[31m'
    const resetColor = '\x1b[0m'

    console.log(`${statusColor}${statusIcon}${resetColor} Current: ${compat.currentVersion}`)
    console.log(`  Latest: ${compat.latestVersion}`)
    console.log(`  Status: ${compat.compatible ? 'Compatible' : 'Breaking changes present'}`)

    if (compat.breakingChanges.length > 0) {
      console.log('\nBreaking Changes:')
      for (const change of compat.breakingChanges) {
        console.log(`  - ${change}`)
      }
    }

    if (compat.deprecationWarnings.length > 0) {
      console.log('\nDeprecation Warnings:')
      for (const warning of compat.deprecationWarnings) {
        console.log(`  - ${warning}`)
      }
    }

    console.log(`\nRecommendation: ${compat.recommendation}\n`)

    return this.output.success({ compatible: compat.compatible })
  }

  /**
   * Add deprecation
   */
  private async deprecate() {
    const scriptName = this.requirePositional(0, 'script')
    const feature = this.requirePositional(1, 'feature')

    const version = this.getFlag('version', '')
    if (!version) {
      throw new ScriptError('Version is required', ErrorCode.VALIDATION_ERROR)
    }

    const reason = this.getFlag('reason', 'Feature is deprecated')
    const alternative = this.getFlag('alternative', 'See documentation for alternatives')
    const removalVersion = this.getFlag('removal', 'TBD')
    const severity = this.getFlag('severity', 'warning') as 'info' | 'warning' | 'error'

    const manager = await getDeprecationManager(PROJECT_ROOT)

    await manager.addDeprecation({
      scriptName,
      feature,
      version,
      reason,
      alternative,
      removalVersion,
      severity,
    })

    if (this.args.flags.json) {
      return this.output.success({
        message: 'Deprecation added',
        scriptName,
        feature,
      })
    }

    this.output.warn(`Added deprecation for ${scriptName}.${feature}`)
    console.log(`  Version: ${version}`)
    console.log(`  Reason: ${reason}`)
    console.log(`  Alternative: ${alternative}`)
    console.log(`  Removal: ${removalVersion}`)
    console.log(`  Severity: ${severity}\n`)

    return this.output.success({ scriptName, feature })
  }

  /**
   * Show deprecation warnings
   */
  private async warnings() {
    const scriptName = this.requirePositional(0, 'script')

    const manager = await getDeprecationManager(PROJECT_ROOT)
    const result = await manager.checkDeprecations(scriptName)

    if (this.args.flags.json) {
      return this.output.success({
        hasDeprecations: result.hasDeprecations,
        warnings: result.warnings,
        errors: result.errors,
        info: result.info,
      })
    }

    if (!result.hasDeprecations) {
      this.output.success(`No deprecations found for ${scriptName}`)
      return this.output.success({ total: 0 })
    }

    console.log(`\nDeprecation Warnings: ${scriptName}\n`)
    console.log('─'.repeat(60))

    if (result.errors.length > 0) {
      console.log('\nERROR:')
      for (const d of result.errors) {
        this.printDeprecation(d)
      }
    }

    if (result.warnings.length > 0) {
      console.log('\nWARNING:')
      for (const d of result.warnings) {
        this.printDeprecation(d)
      }
    }

    if (result.info.length > 0) {
      console.log('\nINFO:')
      for (const d of result.info) {
        this.printDeprecation(d)
      }
    }

    return this.output.success({
      total: result.warnings.length + result.errors.length + result.info.length,
    })
  }

  /**
   * Show statistics
   */
  private async stats() {
    const versionManager = await getVersionManager(PROJECT_ROOT)
    const deprecationManager = await getDeprecationManager(PROJECT_ROOT)

    const allVersions = await versionManager.getAllVersions()
    const allDeprecations = await deprecationManager.getAllDeprecations()

    // Group by script
    const scriptStats = allVersions.reduce(
      (acc, v) => {
        if (!acc[v.scriptName]) {
          acc[v.scriptName] = {
            versions: 0,
            latestVersion: v.version,
            deprecations: 0,
          }
        }
        acc[v.scriptName].versions++
        return acc
      },
      {} as Record<string, { versions: number; latestVersion: string; deprecations: number }>,
    )

    // Add deprecation counts
    allDeprecations.forEach((d) => {
      if (scriptStats[d.scriptName]) {
        scriptStats[d.scriptName].deprecations++
      }
    })

    if (this.args.flags.json) {
      return this.output.success({
        totalVersions: allVersions.length,
        totalDeprecations: allDeprecations.length,
        scripts: scriptStats,
      })
    }

    console.log('\nVersion Management Statistics\n')
    console.log('─'.repeat(60))
    console.log(`Total versions: ${allVersions.length}`)
    console.log(`Total deprecations: ${allDeprecations.length}`)
    console.log(`Tracked scripts: ${Object.keys(scriptStats).length}\n`)

    if (Object.keys(scriptStats).length > 0) {
      console.log('Per-script breakdown:\n')
      for (const [name, stats] of Object.entries(scriptStats)) {
        console.log(`  ${name}`)
        console.log(`    Latest: ${stats.latestVersion}`)
        console.log(`    Versions: ${stats.versions}`)
        console.log(`    Deprecations: ${stats.deprecations}`)
        console.log()
      }
    }

    return this.output.success({
      totalVersions: allVersions.length,
      totalDeprecations: allDeprecations.length,
    })
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private printVersionList(versions: VersionInfo[]) {
    for (const v of versions) {
      const deprecatedFlag = v.deprecationNotice ? ' [DEPRECATED]' : ''
      console.log(`  ${v.version}${deprecatedFlag}`)
      console.log(`    Released: ${v.releaseDate.toLocaleDateString()}`)
      console.log(`    Author: ${v.author}`)
      console.log(`    ${v.description}`)

      if (v.changelog.length > 0) {
        console.log('    Changelog:')
        for (const item of v.changelog) {
          console.log(`      - ${item}`)
        }
      }

      if (v.breakingChanges.length > 0) {
        console.log('    Breaking changes:')
        for (const item of v.breakingChanges) {
          console.log(`      - ${item}`)
        }
      }

      console.log()
    }
  }

  private printDeprecation(d: Deprecation) {
    console.log(`  ${d.feature} (since v${d.version})`)
    console.log(`    Reason: ${d.reason}`)
    console.log(`    Alternative: ${d.alternative}`)
    console.log(`    Removal: ${d.removalVersion}`)
    console.log()
  }
}

// Run CLI
runCLI(VersionCLI)
