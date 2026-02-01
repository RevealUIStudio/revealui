#!/usr/bin/env tsx
/**
 * Interactive Script Explorer
 *
 * Browse and execute scripts through an interactive menu interface.
 *
 * @example
 * ```bash
 * pnpm explore              # Launch interactive explorer
 * pnpm explore --category db # Filter by category
 * pnpm explore --search build # Search scripts
 * ```
 */

import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import * as readline from 'node:readline/promises'
import { join } from 'node:path'
import { BaseCLI } from './_base.js'
import { getProjectRoot } from '../lib/paths.js'
import type { CommandDefinition, ParsedArgs } from '../lib/args.js'

interface ScriptInfo {
  name: string
  command: string
  category: string
  description?: string
}

class ExploreCLI extends BaseCLI {
  name = 'explore'
  description = 'Interactive script explorer and runner'

  private rl: readline.Interface | null = null
  private scripts: ScriptInfo[] = []

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'interactive',
        description: 'Launch interactive explorer (default)',
        handler: async (args) => this.runInteractive(args),
      },
      {
        name: 'list',
        description: 'List all available scripts',
        options: [
          {
            name: 'category',
            type: 'string',
            description: 'Filter by category',
          },
        ],
        handler: async (args) => this.listScripts(args),
      },
      {
        name: 'search',
        description: 'Search for scripts',
        options: [
          {
            name: 'query',
            type: 'string',
            description: 'Search query',
            required: true,
          },
        ],
        handler: async (args) => this.searchScripts(args),
      },
    ]
  }

  /**
   * Load scripts from package.json
   */
  private async loadScripts(): Promise<void> {
    const root = await getProjectRoot(import.meta.url)
    const pkgPath = join(root, 'package.json')
    const content = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(content)

    this.scripts = []

    for (const [name, command] of Object.entries(pkg.scripts || {})) {
      if (typeof command !== 'string') continue

      // Skip comment entries
      if (name.startsWith('//')) continue

      // Categorize scripts
      const category = this.categorizeScript(name)
      const description = this.getScriptDescription(name, command as string)

      this.scripts.push({
        name,
        command: command as string,
        category,
        description,
      })
    }

    // Sort by category, then name
    this.scripts.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Categorize script by name prefix
   */
  private categorizeScript(name: string): string {
    const prefixes = [
      { prefix: 'build', category: 'Build' },
      { prefix: 'dev', category: 'Development' },
      { prefix: 'test', category: 'Testing' },
      { prefix: 'lint', category: 'Code Quality' },
      { prefix: 'format', category: 'Code Quality' },
      { prefix: 'typecheck', category: 'Code Quality' },
      { prefix: 'db:', category: 'Database' },
      { prefix: 'setup', category: 'Setup' },
      { prefix: 'validate', category: 'Validation' },
      { prefix: 'analyze', category: 'Analysis' },
      { prefix: 'maintain', category: 'Maintenance' },
      { prefix: 'release', category: 'Release' },
      { prefix: 'workflow', category: 'Workflows' },
      { prefix: 'skills', category: 'Skills' },
      { prefix: 'mcp:', category: 'MCP' },
      { prefix: 'docs:', category: 'Documentation' },
      { prefix: 'metrics', category: 'Metrics' },
      { prefix: 'build-cache', category: 'Caching' },
      { prefix: 'clean', category: 'Cleanup' },
      { prefix: 'install', category: 'Installation' },
    ]

    for (const { prefix, category } of prefixes) {
      if (name.startsWith(prefix)) {
        return category
      }
    }

    return 'Other'
  }

  /**
   * Get description for a script
   */
  private getScriptDescription(name: string, command: string): string {
    // Extract description from common patterns
    const descriptions: Record<string, string> = {
      build: 'Build all packages',
      dev: 'Start development server',
      test: 'Run test suite',
      lint: 'Check code quality',
      format: 'Format code',
      clean: 'Clean build artifacts',
      'db:init': 'Initialize database',
      'db:migrate': 'Run database migrations',
      'db:seed': 'Seed sample data',
      typecheck: 'Type-check TypeScript',
    }

    return descriptions[name] || this.inferDescription(command)
  }

  /**
   * Infer description from command
   */
  private inferDescription(command: string): string {
    if (command.includes('turbo run')) {
      return 'Run turbo task'
    }
    if (command.includes('tsx scripts/')) {
      const match = command.match(/tsx scripts\/([^/]+)\/([^/\s]+)/)
      if (match) {
        return `Run ${match[1]} script`
      }
    }
    return 'Run script'
  }

  /**
   * Run interactive explorer
   */
  private async runInteractive(args: ParsedArgs): Promise<number> {
    await this.loadScripts()

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    try {
      this.output.header('🔍 Script Explorer')
      console.log('Browse and execute scripts interactively\n')

      while (true) {
        const action = await this.showMainMenu()

        if (action === 'exit') {
          console.log('\n👋 Goodbye!')
          break
        }

        if (action === 'category') {
          await this.browseByCategory()
        } else if (action === 'search') {
          await this.interactiveSearch()
        } else if (action === 'list') {
          await this.showAllScripts()
        }
      }

      return 0
    } finally {
      this.rl?.close()
    }
  }

  /**
   * Show main menu
   */
  private async showMainMenu(): Promise<string> {
    console.log('\nWhat would you like to do?')
    console.log('  1. Browse by category')
    console.log('  2. Search scripts')
    console.log('  3. List all scripts')
    console.log('  4. Exit')

    const answer = await this.rl!.question('\nSelect option (1-4): ')

    switch (answer.trim()) {
      case '1':
        return 'category'
      case '2':
        return 'search'
      case '3':
        return 'list'
      case '4':
        return 'exit'
      default:
        console.log('Invalid option, try again.')
        return this.showMainMenu()
    }
  }

  /**
   * Browse scripts by category
   */
  private async browseByCategory(): Promise<void> {
    const categories = [...new Set(this.scripts.map((s) => s.category))].sort()

    console.log('\n📂 Categories:')
    categories.forEach((cat, i) => {
      const count = this.scripts.filter((s) => s.category === cat).length
      console.log(`  ${i + 1}. ${cat} (${count} scripts)`)
    })
    console.log(`  ${categories.length + 1}. Back`)

    const answer = await this.rl!.question('\nSelect category: ')
    const index = parseInt(answer.trim(), 10) - 1

    if (index === categories.length) {
      return
    }

    if (index >= 0 && index < categories.length) {
      await this.showCategoryScripts(categories[index])
    }
  }

  /**
   * Show scripts in a category
   */
  private async showCategoryScripts(category: string): Promise<void> {
    const scripts = this.scripts.filter((s) => s.category === category)

    console.log(`\n📂 ${category} Scripts:`)
    scripts.forEach((script, i) => {
      console.log(`  ${i + 1}. ${script.name}`)
      if (script.description) {
        console.log(`     ${script.description}`)
      }
    })
    console.log(`  ${scripts.length + 1}. Back`)

    const answer = await this.rl!.question('\nSelect script to run (or back): ')
    const index = parseInt(answer.trim(), 10) - 1

    if (index === scripts.length) {
      return
    }

    if (index >= 0 && index < scripts.length) {
      await this.executeScript(scripts[index])
    }
  }

  /**
   * Interactive search
   */
  private async interactiveSearch(): Promise<void> {
    const query = await this.rl!.question('\n🔍 Search query: ')

    if (!query.trim()) {
      return
    }

    const results = this.scripts.filter(
      (s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.description?.toLowerCase().includes(query.toLowerCase()) ||
        s.command.toLowerCase().includes(query.toLowerCase())
    )

    if (results.length === 0) {
      console.log('\nNo scripts found matching your query.')
      return
    }

    console.log(`\n✨ Found ${results.length} scripts:`)
    results.forEach((script, i) => {
      console.log(`  ${i + 1}. ${script.name} (${script.category})`)
      if (script.description) {
        console.log(`     ${script.description}`)
      }
    })
    console.log(`  ${results.length + 1}. Back`)

    const answer = await this.rl!.question('\nSelect script to run (or back): ')
    const index = parseInt(answer.trim(), 10) - 1

    if (index === results.length) {
      return
    }

    if (index >= 0 && index < results.length) {
      await this.executeScript(results[index])
    }
  }

  /**
   * Show all scripts
   */
  private async showAllScripts(): Promise<void> {
    let currentCategory = ''

    console.log('\n📋 All Scripts:')
    this.scripts.forEach((script) => {
      if (script.category !== currentCategory) {
        currentCategory = script.category
        console.log(`\n${currentCategory}:`)
      }
      console.log(`  • ${script.name}`)
      if (script.description) {
        console.log(`    ${script.description}`)
      }
    })

    await this.rl!.question('\nPress Enter to continue...')
  }

  /**
   * Execute a script
   */
  private async executeScript(script: ScriptInfo): Promise<void> {
    console.log(`\n▶️  Running: ${script.name}`)
    console.log(`Command: ${script.command}\n`)

    const confirm = await this.rl!.question('Execute this script? (y/N): ')

    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.')
      return
    }

    // Close readline to allow script to use stdin
    this.rl?.close()
    this.rl = null

    return new Promise((resolve) => {
      const child = spawn('pnpm', ['run', script.name], {
        stdio: 'inherit',
        shell: true,
      })

      child.on('exit', (code) => {
        console.log(`\n✅ Script ${code === 0 ? 'completed' : 'failed'}`)

        // Recreate readline
        this.rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })

        this.rl.question('\nPress Enter to continue...', () => {
          resolve()
        })
      })
    })
  }

  /**
   * List scripts (non-interactive)
   */
  private async listScripts(args: ParsedArgs): Promise<number> {
    await this.loadScripts()

    let scripts = this.scripts

    if (args.category) {
      scripts = scripts.filter(
        (s) => s.category.toLowerCase() === (args.category as string).toLowerCase()
      )
    }

    if (args.json) {
      this.output.success({ scripts, total: scripts.length })
      return 0
    }

    let currentCategory = ''

    scripts.forEach((script) => {
      if (script.category !== currentCategory) {
        currentCategory = script.category
        console.log(`\n${currentCategory}:`)
      }
      console.log(`  ${script.name}`)
      if (script.description) {
        console.log(`    ${script.description}`)
      }
    })

    console.log(`\nTotal: ${scripts.length} scripts`)

    return 0
  }

  /**
   * Search scripts (non-interactive)
   */
  private async searchScripts(args: ParsedArgs): Promise<number> {
    await this.loadScripts()

    const query = args.query as string
    const results = this.scripts.filter(
      (s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.description?.toLowerCase().includes(query.toLowerCase()) ||
        s.command.toLowerCase().includes(query.toLowerCase())
    )

    if (args.json) {
      this.output.success({ results, total: results.length, query })
      return 0
    }

    if (results.length === 0) {
      console.log(`No scripts found matching "${query}"`)
      return 0
    }

    console.log(`\nFound ${results.length} scripts matching "${query}":\n`)

    results.forEach((script) => {
      console.log(`  ${script.name} (${script.category})`)
      if (script.description) {
        console.log(`    ${script.description}`)
      }
      console.log(`    Command: ${script.command}`)
      console.log()
    })

    return 0
  }
}

// Run CLI
const cli = new ExploreCLI()
const exitCode = await cli.run()
process.exit(exitCode)
