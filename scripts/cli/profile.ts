#!/usr/bin/env tsx
/**
 * Performance Profiling CLI
 *
 * Profile and benchmark script execution, builds, and tests.
 *
 * @example
 * ```bash
 * pnpm profile:build              # Profile build performance
 * pnpm profile:test               # Profile test execution
 * pnpm profile:script "pnpm dev"  # Profile any command
 * pnpm profile:benchmark          # Run benchmarks
 * ```
 */

import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { BaseCLI } from './_base.js'
import { telemetry } from '../lib/telemetry.js'
import { formatDuration, formatBytes } from '../lib/utils.js'
import type { CommandDefinition, ParsedArgs } from '../lib/args.js'

interface ProfileResult {
  command: string
  duration: number
  peakMemory: number
  averageMemory: number
  cpuUsage: number
  exitCode: number
  timestamp: number
}

class ProfileCLI extends BaseCLI {
  name = 'profile'
  description = 'Performance profiling and benchmarking'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'build',
        description: 'Profile build performance',
        options: [
          {
            name: 'iterations',
            type: 'number',
            description: 'Number of iterations to run',
            defaultValue: 1,
          },
          {
            name: 'clean',
            type: 'boolean',
            description: 'Clean before each build',
          },
        ],
        handler: async (args) => this.profileBuild(args),
      },
      {
        name: 'test',
        description: 'Profile test execution',
        options: [
          {
            name: 'package',
            type: 'string',
            description: 'Specific package to test',
          },
        ],
        handler: async (args) => this.profileTest(args),
      },
      {
        name: 'script',
        description: 'Profile any script or command',
        options: [
          {
            name: 'command',
            type: 'string',
            description: 'Command to profile',
            required: true,
          },
          {
            name: 'iterations',
            type: 'number',
            description: 'Number of iterations',
            defaultValue: 1,
          },
        ],
        handler: async (args) => this.profileScript(args),
      },
      {
        name: 'benchmark',
        description: 'Run performance benchmarks',
        handler: async (args) => this.runBenchmark(args),
      },
      {
        name: 'compare',
        description: 'Compare two command performances',
        options: [
          {
            name: 'cmd1',
            type: 'string',
            description: 'First command',
            required: true,
          },
          {
            name: 'cmd2',
            type: 'string',
            description: 'Second command',
            required: true,
          },
          {
            name: 'iterations',
            type: 'number',
            description: 'Iterations per command',
            defaultValue: 3,
          },
        ],
        handler: async (args) => this.compareCommands(args),
      },
    ]
  }

  /**
   * Profile build performance
   */
  private async profileBuild(args: ParsedArgs): Promise<number> {
    const iterations = (args.iterations as number) || 1
    const clean = args.clean as boolean

    if (!args.json) {
      this.output.header('Build Performance Profile')
      console.log(`Iterations: ${iterations}`)
      console.log(`Clean builds: ${clean ? 'Yes' : 'No'}\n`)
    }

    const results: ProfileResult[] = []

    for (let i = 0; i < iterations; i++) {
      if (!args.json) {
        console.log(`\nIteration ${i + 1}/${iterations}`)
      }

      // Clean if requested
      if (clean && i > 0) {
        if (!args.json) {
          console.log('Cleaning...')
        }
        await this.executeCommand('pnpm clean')
      }

      // Profile build
      const result = await this.profileCommand('pnpm build')
      results.push(result)

      if (!args.json) {
        this.printProfileResult(result)
      }
    }

    if (args.json) {
      this.output.success({ results, average: this.calculateAverage(results) })
    } else {
      this.printSummary(results)
    }

    // Track telemetry
    for (const result of results) {
      telemetry.startTimer('build-profile').stop({ duration: result.duration })
    }

    return 0
  }

  /**
   * Profile test execution
   */
  private async profileTest(args: ParsedArgs): Promise<number> {
    const pkg = args.package as string | undefined

    if (!args.json) {
      this.output.header('Test Performance Profile')
      if (pkg) {
        console.log(`Package: ${pkg}\n`)
      }
    }

    const command = pkg ? `pnpm --filter ${pkg} test` : 'pnpm test'
    const result = await this.profileCommand(command)

    if (args.json) {
      this.output.success({ result })
    } else {
      this.printProfileResult(result)
    }

    telemetry.startTimer('test-profile').stop({ duration: result.duration })

    return 0
  }

  /**
   * Profile any script
   */
  private async profileScript(args: ParsedArgs): Promise<number> {
    const command = args.command as string
    const iterations = (args.iterations as number) || 1

    if (!args.json) {
      this.output.header('Script Performance Profile')
      console.log(`Command: ${command}`)
      console.log(`Iterations: ${iterations}\n`)
    }

    const results: ProfileResult[] = []

    for (let i = 0; i < iterations; i++) {
      if (!args.json && iterations > 1) {
        console.log(`\nIteration ${i + 1}/${iterations}`)
      }

      const result = await this.profileCommand(command)
      results.push(result)

      if (!args.json) {
        this.printProfileResult(result)
      }
    }

    if (args.json) {
      this.output.success({ results, average: this.calculateAverage(results) })
    } else if (iterations > 1) {
      this.printSummary(results)
    }

    return 0
  }

  /**
   * Run benchmarks
   */
  private async runBenchmark(args: ParsedArgs): Promise<number> {
    if (!args.json) {
      this.output.header('Performance Benchmarks')
    }

    const benchmarks = [
      { name: 'TypeScript Compilation', command: 'pnpm typecheck:all' },
      { name: 'Linting', command: 'pnpm lint' },
      { name: 'Test Suite', command: 'pnpm test' },
    ]

    const results: Array<ProfileResult & { name: string }> = []

    for (const benchmark of benchmarks) {
      if (!args.json) {
        console.log(`\nRunning: ${benchmark.name}`)
      }

      const result = await this.profileCommand(benchmark.command)
      results.push({ ...result, name: benchmark.name })

      if (!args.json) {
        this.printProfileResult(result)
      }
    }

    if (args.json) {
      this.output.success({ benchmarks: results })
    } else {
      console.log('\n' + '='.repeat(60))
      console.log('Benchmark Summary')
      console.log('='.repeat(60))

      for (const result of results) {
        console.log(`\n${result.name}:`)
        console.log(`  Duration:     ${formatDuration(result.duration)}`)
        console.log(`  Peak Memory:  ${formatBytes(result.peakMemory)}`)
      }
    }

    return 0
  }

  /**
   * Compare two commands
   */
  private async compareCommands(args: ParsedArgs): Promise<number> {
    const cmd1 = args.cmd1 as string
    const cmd2 = args.cmd2 as string
    const iterations = (args.iterations as number) || 3

    if (!args.json) {
      this.output.header('Command Performance Comparison')
      console.log(`Command 1: ${cmd1}`)
      console.log(`Command 2: ${cmd2}`)
      console.log(`Iterations: ${iterations}\n`)
    }

    // Profile command 1
    const results1: ProfileResult[] = []
    for (let i = 0; i < iterations; i++) {
      if (!args.json) {
        console.log(`\nCommand 1 - Iteration ${i + 1}/${iterations}`)
      }
      const result = await this.profileCommand(cmd1)
      results1.push(result)
      if (!args.json) {
        console.log(`  Duration: ${formatDuration(result.duration)}`)
      }
    }

    // Profile command 2
    const results2: ProfileResult[] = []
    for (let i = 0; i < iterations; i++) {
      if (!args.json) {
        console.log(`\nCommand 2 - Iteration ${i + 1}/${iterations}`)
      }
      const result = await this.profileCommand(cmd2)
      results2.push(result)
      if (!args.json) {
        console.log(`  Duration: ${formatDuration(result.duration)}`)
      }
    }

    const avg1 = this.calculateAverage(results1)
    const avg2 = this.calculateAverage(results2)

    if (args.json) {
      this.output.success({
        command1: { command: cmd1, results: results1, average: avg1 },
        command2: { command: cmd2, results: results2, average: avg2 },
        comparison: {
          fasterCommand: avg1.duration < avg2.duration ? cmd1 : cmd2,
          speedup: Math.abs((avg1.duration - avg2.duration) / Math.max(avg1.duration, avg2.duration)) * 100,
        },
      })
    } else {
      console.log('\n' + '='.repeat(60))
      console.log('Comparison Results')
      console.log('='.repeat(60))
      console.log(`\nCommand 1 (${cmd1}):`)
      console.log(`  Avg Duration:  ${formatDuration(avg1.duration)}`)
      console.log(`  Avg Memory:    ${formatBytes(avg1.averageMemory)}`)
      console.log(`\nCommand 2 (${cmd2}):`)
      console.log(`  Avg Duration:  ${formatDuration(avg2.duration)}`)
      console.log(`  Avg Memory:    ${formatBytes(avg2.averageMemory)}`)

      const faster = avg1.duration < avg2.duration ? 'Command 1' : 'Command 2'
      const speedup = Math.abs((avg1.duration - avg2.duration) / Math.max(avg1.duration, avg2.duration)) * 100
      console.log(`\n${faster} is ${speedup.toFixed(1)}% faster`)
    }

    return 0
  }

  /**
   * Profile a command execution
   */
  private async profileCommand(command: string): Promise<ProfileResult> {
    const startTime = performance.now()
    const startMemory = process.memoryUsage()
    let peakMemory = startMemory.heapUsed
    let totalMemory = 0
    let samples = 0

    // Monitor memory during execution
    const memoryInterval = setInterval(() => {
      const current = process.memoryUsage().heapUsed
      peakMemory = Math.max(peakMemory, current)
      totalMemory += current
      samples++
    }, 100)

    // Execute command
    const exitCode = await this.executeCommand(command)

    clearInterval(memoryInterval)

    const endTime = performance.now()
    const duration = endTime - startTime

    return {
      command,
      duration,
      peakMemory,
      averageMemory: samples > 0 ? totalMemory / samples : peakMemory,
      cpuUsage: process.cpuUsage().user / 1000, // microseconds to milliseconds
      exitCode,
      timestamp: Date.now(),
    }
  }

  /**
   * Execute a command
   */
  private executeCommand(command: string): Promise<number> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ')
      const child = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
      })

      child.on('exit', (code) => {
        resolve(code || 0)
      })

      child.on('error', () => {
        resolve(1)
      })
    })
  }

  /**
   * Print profile result
   */
  private printProfileResult(result: ProfileResult): void {
    console.log(`  Duration:       ${formatDuration(result.duration)}`)
    console.log(`  Peak Memory:    ${formatBytes(result.peakMemory)}`)
    console.log(`  Average Memory: ${formatBytes(result.averageMemory)}`)
    console.log(`  Exit Code:      ${result.exitCode}`)
  }

  /**
   * Calculate average from multiple results
   */
  private calculateAverage(results: ProfileResult[]): {
    duration: number
    peakMemory: number
    averageMemory: number
  } {
    if (results.length === 0) {
      return { duration: 0, peakMemory: 0, averageMemory: 0 }
    }

    return {
      duration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      peakMemory: Math.max(...results.map((r) => r.peakMemory)),
      averageMemory: results.reduce((sum, r) => sum + r.averageMemory, 0) / results.length,
    }
  }

  /**
   * Print summary of multiple results
   */
  private printSummary(results: ProfileResult[]): void {
    const avg = this.calculateAverage(results)

    console.log('\n' + '='.repeat(60))
    console.log('Summary Statistics')
    console.log('='.repeat(60))
    console.log(`\nIterations:        ${results.length}`)
    console.log(`Average Duration:  ${formatDuration(avg.duration)}`)
    console.log(`Peak Memory:       ${formatBytes(avg.peakMemory)}`)
    console.log(`Average Memory:    ${formatBytes(avg.averageMemory)}`)

    const durations = results.map((r) => r.duration)
    console.log(`Fastest:           ${formatDuration(Math.min(...durations))}`)
    console.log(`Slowest:           ${formatDuration(Math.max(...durations))}`)
  }
}

// Run CLI
const cli = new ProfileCLI()
const exitCode = await cli.run()
process.exit(exitCode)
