/**
 * Change Preview UI
 *
 * Renders dry-run changes in human-readable format with colored diff,
 * JSON output for automation, and interactive confirmation prompts.
 *
 * @dependencies
 * - scripts/lib/dry-run/dry-run-engine.ts - Change and ImpactLevel type definitions
 * - scripts/lib/dry-run/impact-analyzer.ts - ImpactAnalysis type definition
 * - node:readline - Interactive confirmation prompts
 *
 * @example
 * ```typescript
 * const preview = new ChangePreview()
 * const changes = dryRun.getChanges()
 * const analysis = analyzer.analyze(changes)
 *
 * // Render preview
 * preview.render(changes, analysis)
 *
 * // Get confirmation
 * const confirmed = await preview.confirm('Proceed with changes?')
 * ```
 */

import * as readline from 'node:readline'
import type { Change, ImpactLevel } from './dry-run-engine.js'
import type { ImpactAnalysis } from './impact-analyzer.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Preview rendering options
 */
export interface PreviewOptions {
  /** Output format */
  format?: 'human' | 'json' | 'compact'

  /** Whether to use colors */
  colors?: boolean

  /** Show detailed diff for changes */
  showDiff?: boolean

  /** Maximum number of changes to display */
  maxChanges?: number
}

/**
 * Confirmation options
 */
export interface ConfirmOptions {
  /** Default response if user just presses Enter */
  defaultYes?: boolean

  /** Require explicit 'yes' instead of 'y' */
  requireExplicit?: boolean
}

// =============================================================================
// ANSI Color Codes
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

// =============================================================================
// Change Preview
// =============================================================================

export class ChangePreview {
  private useColors: boolean

  constructor(useColors = true) {
    this.useColors = useColors && process.stdout.isTTY
  }

  /**
   * Render changes and analysis
   */
  render(changes: Change[], analysis: ImpactAnalysis, options: PreviewOptions = {}): void {
    const {
      format = 'human',
      colors: useColors = this.useColors,
      showDiff = false,
      maxChanges = 100,
    } = options

    // Temporarily override colors setting
    const originalColors = this.useColors
    this.useColors = useColors

    if (format === 'json') {
      this.renderJSON(changes, analysis)
    } else if (format === 'compact') {
      this.renderCompact(changes, analysis)
    } else {
      this.renderHuman(changes, analysis, showDiff, maxChanges)
    }

    // Restore original colors setting
    this.useColors = originalColors
  }

  /**
   * Prompt for user confirmation
   */
  async confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    const { defaultYes = false, requireExplicit = false } = options

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const defaultText = defaultYes ? ' [Y/n]' : ' [y/N]'
      const promptText = requireExplicit
        ? `${message} (type 'yes' to confirm) `
        : `${message}${defaultText} `

      rl.question(promptText, (answer) => {
        rl.close()

        const normalized = answer.toLowerCase().trim()

        if (requireExplicit) {
          resolve(normalized === 'yes')
        } else {
          if (normalized === '') {
            resolve(defaultYes)
          } else {
            resolve(normalized === 'y' || normalized === 'yes')
          }
        }
      })
    })
  }

  // ===========================================================================
  // Rendering Methods
  // ===========================================================================

  /**
   * Render in human-readable format
   */
  private renderHuman(
    changes: Change[],
    analysis: ImpactAnalysis,
    showDiff: boolean,
    maxChanges: number,
  ): void {
    console.log()
    this.printHeader('DRY-RUN PREVIEW')
    console.log()

    // Summary
    this.printSection('Summary')
    console.log(`  Total Changes: ${this.colorize(String(analysis.totalChanges), 'bold')}`)
    console.log(`  Overall Impact: ${this.colorizeImpact(analysis.overallImpact)}`)
    console.log(`  Rollback: ${this.colorize(analysis.rollbackComplexity, 'cyan')}`)
    console.log(
      `  Est. Duration: ${this.colorize(this.formatDuration(analysis.estimatedDuration), 'blue')}`,
    )
    console.log()

    // Changes by type
    this.printSection('Changes by Type')
    for (const [type, count] of Object.entries(analysis.changesByType)) {
      // biome-ignore lint/suspicious/noExplicitAny: Type comes from analysis object keys
      const icon = this.getChangeIcon(type as any)
      console.log(`  ${icon} ${type}: ${count}`)
    }
    console.log()

    // Risks
    if (analysis.risks.length > 0) {
      this.printSection('Identified Risks')
      for (const risk of analysis.risks) {
        const severityColor = this.getSeverityColor(risk.severity)
        const icon = this.getRiskIcon(risk.severity)
        console.log(
          `  ${icon} ${this.colorize(`[${risk.severity.toUpperCase()}]`, severityColor)} ${risk.description}`,
        )

        if (risk.mitigation && risk.mitigation.length > 0) {
          console.log(`    ${this.colorize('Mitigation:', 'dim')}`)
          for (const step of risk.mitigation) {
            console.log(`      - ${step}`)
          }
        }
      }
      console.log()
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      this.printSection('Recommendations')
      for (const rec of analysis.recommendations) {
        console.log(`  ${this.colorize('•', 'yellow')} ${rec}`)
      }
      console.log()
    }

    // Detailed changes
    this.printSection('Detailed Changes')
    const displayChanges = changes.slice(0, maxChanges)

    for (const change of displayChanges) {
      this.printChange(change, showDiff)
    }

    if (changes.length > maxChanges) {
      console.log(`  ${this.colorize(`... and ${changes.length - maxChanges} more`, 'dim')}`)
      console.log()
    }

    // Footer
    this.printDivider()
    console.log()
  }

  /**
   * Render in JSON format
   */
  private renderJSON(changes: Change[], analysis: ImpactAnalysis): void {
    console.log(
      JSON.stringify(
        {
          changes,
          analysis,
        },
        null,
        2,
      ),
    )
  }

  /**
   * Render in compact format
   */
  private renderCompact(changes: Change[], analysis: ImpactAnalysis): void {
    console.log(
      `[DRY-RUN] ${analysis.totalChanges} changes, ${analysis.overallImpact} impact, ${analysis.risks.length} risks`,
    )

    for (const change of changes) {
      const icon = this.getChangeIcon(change.type)
      console.log(`  ${icon} ${change.type} ${change.target}`)
    }
  }

  /**
   * Print individual change
   */
  private printChange(change: Change, showDiff: boolean): void {
    const icon = this.getChangeIcon(change.type)
    const impactBadge = this.colorizeImpact(change.impact)

    console.log(`  ${icon} ${this.colorize(change.type, 'bold')} ${impactBadge}`)
    console.log(`    ${this.colorize('Target:', 'dim')} ${change.target}`)

    if (showDiff && (change.before !== undefined || change.after !== undefined)) {
      this.printDiff(change)
    }

    console.log()
  }

  /**
   * Print diff for a change
   */
  private printDiff(change: Change): void {
    if (change.before !== undefined) {
      console.log(`    ${this.colorize('- Before:', 'red')}`)
      console.log(`      ${this.formatValue(change.before)}`)
    }

    if (change.after !== undefined) {
      console.log(`    ${this.colorize('+ After:', 'green')}`)
      console.log(`      ${this.formatValue(change.after)}`)
    }
  }

  // ===========================================================================
  // Formatting Helpers
  // ===========================================================================

  /**
   * Print section header
   */
  private printSection(title: string): void {
    console.log(this.colorize(title, 'bold', 'cyan'))
    console.log(this.colorize('─'.repeat(60), 'dim'))
  }

  /**
   * Print main header
   */
  private printHeader(title: string): void {
    console.log(this.colorize('═'.repeat(60), 'bold'))
    console.log(this.colorize(title, 'bold', 'cyan'))
    console.log(this.colorize('═'.repeat(60), 'bold'))
  }

  /**
   * Print divider
   */
  private printDivider(): void {
    console.log(this.colorize('─'.repeat(60), 'dim'))
  }

  /**
   * Colorize text
   */
  private colorize(text: string, ...colorNames: string[]): string {
    if (!this.useColors) return text

    // biome-ignore lint/suspicious/noExplicitAny: Dynamic color access from runtime color names
    const colorCodes = colorNames.map((name) => (colors as any)[name]).filter(Boolean)
    if (colorCodes.length === 0) return text

    return `${colorCodes.join('')}${text}${colors.reset}`
  }

  /**
   * Colorize impact level
   */
  private colorizeImpact(impact: ImpactLevel): string {
    const colorMap: Record<ImpactLevel, string> = {
      low: 'green',
      medium: 'yellow',
      high: 'magenta',
      critical: 'red',
    }

    return this.colorize(impact.toUpperCase(), colorMap[impact])
  }

  /**
   * Get icon for change type
   */
  private getChangeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'file-write': '📝',
      'file-delete': '🗑️ ',
      'file-mkdir': '📁',
      'file-rmdir': '📂',
      'db-query': '💾',
      'db-insert': '➕',
      'db-update': '✏️ ',
      'db-delete': '❌',
      'command-exec': '⚙️ ',
    }

    return iconMap[type] || '•'
  }

  /**
   * Get icon for risk severity
   */
  private getRiskIcon(severity: string): string {
    const iconMap: Record<string, string> = {
      low: 'ℹ️ ',
      medium: '⚠️ ',
      high: '🔴',
      critical: '🚨',
    }

    return iconMap[severity] || '•'
  }

  /**
   * Get color for severity
   */
  private getSeverityColor(severity: string): string {
    const colorMap: Record<string, string> = {
      low: 'green',
      medium: 'yellow',
      high: 'magenta',
      critical: 'red',
    }

    return colorMap[severity] || 'white'
  }

  /**
   * Format value for display
   */
  private formatValue(value: unknown): string {
    if (typeof value === 'string') {
      return value.length > 100 ? `${value.substring(0, 100)}...` : value
    }

    return JSON.stringify(value, null, 2)
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a change preview instance
 */
export function createChangePreview(useColors = true): ChangePreview {
  return new ChangePreview(useColors)
}
