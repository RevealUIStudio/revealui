/**
 * Bundle Analyzer
 *
 * Analyzes bundle size, dependencies, and optimization opportunities
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, join, relative } from 'path'

export interface BundleStats {
  totalSize: number
  gzipSize?: number
  files: BundleFile[]
  chunks: BundleChunk[]
  dependencies: DependencyStats[]
  duplicates: DuplicateModule[]
  largeFiles: BundleFile[]
}

export interface BundleFile {
  path: string
  size: number
  gzipSize?: number
  type: string
  relativeSize: number
}

export interface BundleChunk {
  name: string
  size: number
  files: string[]
  dependencies: string[]
}

export interface DependencyStats {
  name: string
  version: string
  size: number
  instances: number
  treeshakeable: boolean
}

export interface DuplicateModule {
  name: string
  versions: string[]
  totalSize: number
  locations: string[]
}

/**
 * Analyze bundle directory
 */
export function analyzeBundleDirectory(bundlePath: string): BundleStats {
  const files: BundleFile[] = []
  let totalSize = 0

  // Recursively scan directory
  function scanDirectory(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        scanDirectory(fullPath)
      } else if (entry.isFile()) {
        const stats = statSync(fullPath)
        const relativePath = relative(bundlePath, fullPath)
        const ext = extname(entry.name)

        files.push({
          path: relativePath,
          size: stats.size,
          type: ext,
          relativeSize: 0, // Will calculate after total
        })

        totalSize += stats.size
      }
    }
  }

  scanDirectory(bundlePath)

  // Calculate relative sizes
  for (const file of files) {
    file.relativeSize = (file.size / totalSize) * 100
  }

  // Find large files (>100KB)
  const largeFiles = files.filter((f) => f.size > 100 * 1024).sort((a, b) => b.size - a.size)

  return {
    totalSize,
    files,
    chunks: [], // Would need webpack stats for this
    dependencies: [],
    duplicates: [],
    largeFiles,
  }
}

/**
 * Format file size
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Analyze webpack stats
 */
export function analyzeWebpackStats(statsPath: string): BundleStats {
  const statsJson = JSON.parse(readFileSync(statsPath, 'utf-8'))

  const files: BundleFile[] = []
  const chunks: BundleChunk[] = []
  const dependencies: Map<string, DependencyStats> = new Map()
  let totalSize = 0

  // Process assets
  if (statsJson.assets) {
    for (const asset of statsJson.assets) {
      files.push({
        path: asset.name,
        size: asset.size,
        type: extname(asset.name),
        relativeSize: 0,
      })
      totalSize += asset.size
    }
  }

  // Calculate relative sizes
  for (const file of files) {
    file.relativeSize = (file.size / totalSize) * 100
  }

  // Process chunks
  if (statsJson.chunks) {
    for (const chunk of statsJson.chunks) {
      chunks.push({
        name: chunk.names?.[0] || chunk.id,
        size: chunk.size,
        files: chunk.files || [],
        dependencies: [],
      })
    }
  }

  // Process modules for dependencies
  if (statsJson.modules) {
    for (const module of statsJson.modules) {
      const match = module.name?.match(/node_modules\/(@?[^/]+\/[^/]+|@?[^/]+)/)
      if (match) {
        const pkgName = match[1]
        const existing = dependencies.get(pkgName)

        if (existing) {
          existing.instances++
          existing.size += module.size || 0
        } else {
          dependencies.set(pkgName, {
            name: pkgName,
            version: 'unknown',
            size: module.size || 0,
            instances: 1,
            treeshakeable: false,
          })
        }
      }
    }
  }

  const largeFiles = files.filter((f) => f.size > 100 * 1024).sort((a, b) => b.size - a.size)

  return {
    totalSize,
    files,
    chunks,
    dependencies: Array.from(dependencies.values()).sort((a, b) => b.size - a.size),
    duplicates: [],
    largeFiles,
  }
}

/**
 * Find duplicate dependencies
 */
export function findDuplicateDependencies(stats: BundleStats): DuplicateModule[] {
  const modules = new Map<string, { versions: Set<string>; size: number }>()

  // This would need module resolution data
  // Placeholder implementation

  return []
}

/**
 * Get optimization suggestions
 */
export interface OptimizationSuggestion {
  type: 'bundle-split' | 'tree-shaking' | 'dynamic-import' | 'compression' | 'dependency'
  severity: 'critical' | 'warning' | 'info'
  message: string
  potentialSavings?: number
  file?: string
}

export function getOptimizationSuggestions(stats: BundleStats): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []

  // Check total bundle size
  if (stats.totalSize > 500 * 1024) {
    suggestions.push({
      type: 'bundle-split',
      severity: 'critical',
      message: `Total bundle size (${formatSize(stats.totalSize)}) exceeds 500KB. Consider code splitting.`,
      potentialSavings: stats.totalSize - 500 * 1024,
    })
  }

  // Check for large files
  for (const file of stats.largeFiles) {
    if (file.size > 200 * 1024) {
      suggestions.push({
        type: 'dynamic-import',
        severity: 'warning',
        message: `Large file ${file.path} (${formatSize(file.size)}). Consider lazy loading.`,
        potentialSavings: file.size * 0.7, // Assume 70% can be deferred
        file: file.path,
      })
    }
  }

  // Check for duplicate dependencies
  if (stats.duplicates.length > 0) {
    for (const dup of stats.duplicates) {
      suggestions.push({
        type: 'dependency',
        severity: 'warning',
        message: `Duplicate dependency ${dup.name} found in ${dup.versions.length} versions`,
        potentialSavings: dup.totalSize * 0.5,
      })
    }
  }

  // Check for large dependencies
  for (const dep of stats.dependencies) {
    if (dep.size > 100 * 1024) {
      suggestions.push({
        type: 'tree-shaking',
        severity: 'info',
        message: `Large dependency ${dep.name} (${formatSize(dep.size)}). Verify tree shaking.`,
      })
    }
  }

  return suggestions.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

/**
 * Generate bundle report
 */
export function generateBundleReport(stats: BundleStats): string {
  const suggestions = getOptimizationSuggestions(stats)

  let report = '# Bundle Analysis Report\n\n'

  report += `## Summary\n\n`
  report += `- Total Size: ${formatSize(stats.totalSize)}\n`
  report += `- Files: ${stats.files.length}\n`
  report += `- Chunks: ${stats.chunks.length}\n`
  report += `- Dependencies: ${stats.dependencies.length}\n`
  report += `- Large Files: ${stats.largeFiles.length}\n\n`

  if (stats.largeFiles.length > 0) {
    report += `## Large Files (>100KB)\n\n`
    report += `| File | Size | % of Total |\n`
    report += `|------|------|------------|\n`

    for (const file of stats.largeFiles.slice(0, 10)) {
      report += `| ${file.path} | ${formatSize(file.size)} | ${file.relativeSize.toFixed(1)}% |\n`
    }
    report += '\n'
  }

  if (stats.dependencies.length > 0) {
    report += `## Top Dependencies\n\n`
    report += `| Package | Size | Instances |\n`
    report += `|---------|------|----------|\n`

    for (const dep of stats.dependencies.slice(0, 10)) {
      report += `| ${dep.name} | ${formatSize(dep.size)} | ${dep.instances} |\n`
    }
    report += '\n'
  }

  if (suggestions.length > 0) {
    report += `## Optimization Suggestions\n\n`

    for (const suggestion of suggestions) {
      const icon =
        suggestion.severity === 'critical' ? '🔴' : suggestion.severity === 'warning' ? '⚠️' : 'ℹ️'
      report += `${icon} **${suggestion.type}**: ${suggestion.message}\n`

      if (suggestion.potentialSavings) {
        report += `   Potential savings: ${formatSize(suggestion.potentialSavings)}\n`
      }

      report += '\n'
    }
  }

  return report
}

/**
 * Compare two bundle stats
 */
export interface BundleComparison {
  sizeDiff: number
  sizeChangePercent: number
  filesAdded: number
  filesRemoved: number
  filesChanged: number
  newLargeFiles: BundleFile[]
  improvements: string[]
  regressions: string[]
}

export function compareBundles(before: BundleStats, after: BundleStats): BundleComparison {
  const sizeDiff = after.totalSize - before.totalSize
  const sizeChangePercent = (sizeDiff / before.totalSize) * 100

  const beforeFiles = new Set(before.files.map((f) => f.path))
  const afterFiles = new Set(after.files.map((f) => f.path))

  const filesAdded = after.files.filter((f) => !beforeFiles.has(f.path)).length
  const filesRemoved = before.files.filter((f) => !afterFiles.has(f.path)).length
  const filesChanged = after.files.filter((f) => {
    const beforeFile = before.files.find((bf) => bf.path === f.path)
    return beforeFile && beforeFile.size !== f.size
  }).length

  const newLargeFiles = after.largeFiles.filter((f) => {
    const beforeFile = before.files.find((bf) => bf.path === f.path)
    return !beforeFile || beforeFile.size < 100 * 1024
  })

  const improvements: string[] = []
  const regressions: string[] = []

  if (sizeDiff < 0) {
    improvements.push(`Total bundle size reduced by ${formatSize(Math.abs(sizeDiff))}`)
  } else if (sizeDiff > 0) {
    regressions.push(`Total bundle size increased by ${formatSize(sizeDiff)}`)
  }

  if (after.largeFiles.length < before.largeFiles.length) {
    improvements.push(`${before.largeFiles.length - after.largeFiles.length} fewer large files`)
  } else if (after.largeFiles.length > before.largeFiles.length) {
    regressions.push(`${after.largeFiles.length - before.largeFiles.length} new large files`)
  }

  return {
    sizeDiff,
    sizeChangePercent,
    filesAdded,
    filesRemoved,
    filesChanged,
    newLargeFiles,
    improvements,
    regressions,
  }
}

/**
 * Get bundle health score (0-100)
 */
export function getBundleHealthScore(stats: BundleStats): {
  score: number
  factors: Array<{ name: string; score: number; weight: number; reason: string }>
} {
  const factors: Array<{ name: string; score: number; weight: number; reason: string }> = []

  // Factor 1: Total size (40% weight)
  let sizeScore = 100
  if (stats.totalSize > 1024 * 1024) {
    sizeScore = Math.max(0, 100 - ((stats.totalSize - 1024 * 1024) / (1024 * 1024)) * 50)
  } else if (stats.totalSize > 500 * 1024) {
    sizeScore = 100 - ((stats.totalSize - 500 * 1024) / (500 * 1024)) * 30
  }

  factors.push({
    name: 'Bundle Size',
    score: sizeScore,
    weight: 0.4,
    reason: `Total size: ${formatSize(stats.totalSize)}`,
  })

  // Factor 2: Large files (30% weight)
  const largeFileScore = Math.max(0, 100 - stats.largeFiles.length * 10)
  factors.push({
    name: 'Large Files',
    score: largeFileScore,
    weight: 0.3,
    reason: `${stats.largeFiles.length} files over 100KB`,
  })

  // Factor 3: Chunks (20% weight)
  const optimalChunks = 10
  const chunkScore = 100 - Math.abs(stats.chunks.length - optimalChunks) * 5
  factors.push({
    name: 'Code Splitting',
    score: Math.max(0, chunkScore),
    weight: 0.2,
    reason: `${stats.chunks.length} chunks (optimal: ~${optimalChunks})`,
  })

  // Factor 4: Duplicates (10% weight)
  const duplicateScore = Math.max(0, 100 - stats.duplicates.length * 20)
  factors.push({
    name: 'Dependencies',
    score: duplicateScore,
    weight: 0.1,
    reason: `${stats.duplicates.length} duplicate dependencies`,
  })

  // Calculate weighted score
  const totalScore = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0)

  return {
    score: Math.round(totalScore),
    factors,
  }
}
