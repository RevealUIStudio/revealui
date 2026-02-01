#!/usr/bin/env tsx
/**
 * Build cache management CLI.
 *
 * Manage build cache for improved performance.
 *
 * @example
 * ```bash
 * pnpm build-cache stats              # Show cache statistics
 * pnpm build-cache list               # List all cache entries
 * pnpm build-cache clear              # Clear all cache entries
 * pnpm build-cache cleanup --days 7   # Clean entries older than 7 days
 * ```
 */

import { BaseCLI } from './_base.js'
import { BuildCache, type CacheEntry } from '../lib/cache.js'
import { formatBytes, formatDuration } from '../lib/utils.js'
import type { CommandDefinition, ParsedArgs } from '../lib/args.js'

class BuildCacheCLI extends BaseCLI {
  name = 'build-cache'
  description = 'Build cache management'

  private cache: BuildCache

  constructor() {
    super()
    this.cache = new BuildCache({ verbose: false })
  }

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'stats',
        description: 'Show cache statistics',
        handler: async (args) => this.showStats(args),
      },
      {
        name: 'list',
        description: 'List all cache entries',
        handler: async (args) => this.listEntries(args),
      },
      {
        name: 'clear',
        description: 'Clear all cache entries',
        handler: async (args) => this.clearCache(args),
      },
      {
        name: 'cleanup',
        description: 'Clean up old cache entries',
        options: [
          {
            name: 'days',
            type: 'number',
            description: 'Remove entries older than N days',
            defaultValue: 7,
          },
          {
            name: 'max-size',
            type: 'string',
            description: 'Keep total size under limit (e.g., "500MB", "1GB")',
          },
        ],
        handler: async (args) => this.cleanupCache(args),
      },
      {
        name: 'info',
        description: 'Show cache configuration',
        handler: async (args) => this.showInfo(args),
      },
    ]
  }

  /**
   * Show cache statistics.
   */
  private async showStats(args: ParsedArgs): Promise<number> {
    const stats = await this.cache.getStats()

    if (args.json) {
      this.output.success({
        stats,
      })
      return 0
    }

    this.output.header('Cache Statistics')
    console.log(`Entries:    ${stats.entries}`)
    console.log(`Total Size: ${stats.formattedSize}`)
    console.log(`Hits:       ${stats.hits}`)
    console.log(`Misses:     ${stats.misses}`)
    console.log(`Hit Rate:   ${stats.hitRate}%`)

    return 0
  }

  /**
   * List all cache entries.
   */
  private async listEntries(args: ParsedArgs): Promise<number> {
    const entries = await this.cache.listEntries()

    if (args.json) {
      this.output.success({
        entries,
        count: entries.length,
      })
      return 0
    }

    if (entries.length === 0) {
      console.log('No cache entries found')
      return 0
    }

    this.output.header('Cache Entries')

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp)

    for (const entry of entries) {
      const age = Date.now() - entry.timestamp
      console.log(`\nKey:         ${entry.key}`)
      console.log(`Age:         ${formatDuration(age)}`)
      console.log(`Size:        ${formatBytes(entry.size)}`)
      console.log(`Destination: ${entry.destination}`)
      if (entry.sources.length > 0) {
        console.log(`Sources:     ${entry.sources.length} files`)
      }
    }

    console.log(`\nTotal: ${entries.length} entries`)

    return 0
  }

  /**
   * Clear all cache entries.
   */
  private async clearCache(args: ParsedArgs): Promise<number> {
    const stats = await this.cache.getStats()

    if (stats.entries === 0) {
      if (args.json) {
        this.output.success({ cleared: 0 })
      } else {
        console.log('Cache is already empty')
      }
      return 0
    }

    // Confirm before clearing
    if (!args.json && !args.yes) {
      const readline = await import('node:readline/promises')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const answer = await rl.question(
        `Clear ${stats.entries} cache entries (${stats.formattedSize})? [y/N] `,
      )
      rl.close()

      if (answer.toLowerCase() !== 'y') {
        console.log('Cancelled')
        return 0
      }
    }

    await this.cache.clear()

    if (args.json) {
      this.output.success({
        cleared: stats.entries,
        freedSize: stats.totalSize,
        formattedSize: stats.formattedSize,
      })
    } else {
      this.output.success(`Cleared ${stats.entries} entries (${stats.formattedSize})`)
    }

    return 0
  }

  /**
   * Clean up old cache entries.
   */
  private async cleanupCache(args: ParsedArgs): Promise<number> {
    const beforeStats = await this.cache.getStats()
    const options: {
      olderThan?: number
      maxSize?: number
    } = {}

    // Convert days to milliseconds
    if (args.days) {
      options.olderThan = Number(args.days) * 24 * 60 * 60 * 1000
    }

    // Parse max-size
    if (args['max-size']) {
      options.maxSize = this.parseSize(args['max-size'] as string)
    }

    await this.cache.cleanup(options)

    const afterStats = await this.cache.getStats()
    const deletedCount = beforeStats.entries - afterStats.entries
    const freedSize = beforeStats.totalSize - afterStats.totalSize

    if (args.json) {
      this.output.success({
        deleted: deletedCount,
        freedSize,
        formattedFreedSize: formatBytes(freedSize),
        remainingEntries: afterStats.entries,
        remainingSize: afterStats.totalSize,
        formattedRemainingSize: afterStats.formattedSize,
      })
      return 0
    }

    if (deletedCount === 0) {
      console.log('No entries to clean up')
    } else {
      this.output.success(`Cleaned up ${deletedCount} entries, freed ${formatBytes(freedSize)}`)
      console.log(`Remaining: ${afterStats.entries} entries (${afterStats.formattedSize})`)
    }

    return 0
  }

  /**
   * Show cache configuration.
   */
  private async showInfo(args: ParsedArgs): Promise<number> {
    const info = {
      cacheDir: '.cache/build',
      ttl: '24 hours',
      maxSize: '1 GB',
    }

    if (args.json) {
      this.output.success(info)
      return 0
    }

    this.output.header('Cache Configuration')
    console.log(`Directory:  ${info.cacheDir}`)
    console.log(`TTL:        ${info.ttl}`)
    console.log(`Max Size:   ${info.maxSize}`)

    return 0
  }

  /**
   * Parse size string (e.g., "500MB", "1GB") to bytes.
   */
  private parseSize(size: string): number {
    const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i)
    if (!match) {
      throw new Error(`Invalid size format: ${size}`)
    }

    const value = Number.parseFloat(match[1])
    const unit = (match[2] || 'B').toUpperCase()

    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    }

    return Math.floor(value * multipliers[unit])
  }
}

// Run CLI
const cli = new BuildCacheCLI()
const exitCode = await cli.run()
process.exit(exitCode)
