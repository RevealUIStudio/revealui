#!/usr/bin/env node
/**
 * File Manager - Automated File Lifecycle Management
 *
 * Manages the automated lifecycle of analysis files:
 * analyses/ → plans/ → implementations/ → archives/
 *
 * Implements the standardized naming convention and automatic file movement.
 */

import { readdirSync, statSync, existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { execSync } from 'node:child_process'

interface FileMetadata {
  path: string
  name: string
  type: 'analysis' | 'plan' | 'implementation' | 'review' | 'archive'
  status: 'pending' | 'approved' | 'completed' | 'archived'
  project: string
  created: Date
  modified: Date
  size: number
}

export class FileManager {
  private docsDir: string
  private analysesDir: string
  private plansDir: string
  private implementationsDir: string
  private reviewsDir: string
  private archivesDir: string

  constructor() {
    this.docsDir = join(process.cwd(), 'docs')
    this.analysesDir = join(this.docsDir, 'analyses')
    this.plansDir = join(this.docsDir, 'plans')
    this.implementationsDir = join(this.docsDir, 'implementations')
    this.reviewsDir = join(this.docsDir, 'reviews')
    this.archivesDir = join(this.docsDir, 'archives')
  }

  initialize(): void {
    // Create directory structure
    const dirs = [this.analysesDir, this.plansDir, this.implementationsDir, this.reviewsDir, this.archivesDir]
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
        console.log(`📁 Created directory: ${dir}`)
      }
    }
  }

  scanAndOrganize(): void {
    console.log('🔍 Scanning and organizing files...')

    // Process analyses that qualify for promotion to plans
    this.processAnalysesToPlans()

    // Process plans ready for implementation
    this.processPlansToImplementations()

    // Process implementations ready for review
    this.processImplementationsToReviews()

    // Process completed implementations for archiving
    this.processImplementationsToArchives()

    console.log('✅ File organization complete')
  }

  private processAnalysesToPlans(): void {
    if (!existsSync(this.analysesDir)) return

    const analysisFiles = readdirSync(this.analysesDir)
      .filter(file => file.endsWith('.md'))
      .map(file => join(this.analysesDir, file))

    for (const filePath of analysisFiles) {
      if (this.isAnalysisReadyForPlan(filePath)) {
        this.promoteToPlan(filePath)
      }
    }
  }

  private processPlansToImplementations(): void {
    if (!existsSync(this.plansDir)) return

    const planFiles = readdirSync(this.plansDir)
      .filter(file => file.endsWith('.md'))
      .map(file => join(this.plansDir, file))

    for (const filePath of planFiles) {
      if (this.isPlanReadyForImplementation(filePath)) {
        this.promoteToImplementation(filePath)
      }
    }
  }

  private processImplementationsToArchives(): void {
    if (!existsSync(this.implementationsDir)) return

    const implementationFiles = readdirSync(this.implementationsDir)
      .filter(file => file.endsWith('.md'))
      .map(file => join(this.implementationsDir, file))

    for (const filePath of implementationFiles) {
      if (this.isImplementationReadyForArchive(filePath)) {
        this.archiveImplementation(filePath)
      }
    }
  }

  private processImplementationsToReviews(): void {
    if (!existsSync(this.implementationsDir)) return

    const implementationFiles = readdirSync(this.implementationsDir)
      .filter(file => file.endsWith('.md'))
      .map(file => join(this.implementationsDir, file))

    for (const filePath of implementationFiles) {
      if (this.isImplementationReadyForReview(filePath)) {
        this.createReviewForImplementation(filePath)
      }
    }
  }

  private isImplementationReadyForReview(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf8')

      // Check for completion indicators that suggest review is needed
      const hasImplementation = content.includes('## Implementation') || content.includes('## Code Changes')
      const hasValidation = content.includes('## Validation') || content.includes('## Testing')
      const hasResults = content.includes('SUCCESS') || content.includes('COMPLETED') || content.includes('FAILED')

      return hasImplementation && hasValidation && hasResults
    } catch {
      return false
    }
  }

  private createReviewForImplementation(implementationPath: string): void {
    const fileName = basename(implementationPath, '.md')
    const project = this.extractProjectName(fileName)

    try {
      // Generate review using review-generator script
      const reviewCommand = `node scripts/review-generator.ts "${project}" "${fileName}"`
      execSync(reviewCommand, { stdio: 'inherit', timeout: 300000 })

      // Move implementation to completed status
      const completedFileName = fileName.replace('in-progress', 'completed')
      const completedPath = join(this.implementationsDir, completedFileName)
      renameSync(implementationPath, completedPath)

      console.log(`📋 Created review for implementation: ${fileName}`)
    } catch (error) {
      console.log(`⚠️  Failed to create review for ${fileName}: ${error}`)
    }
  }

  private isAnalysisReadyForPlan(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf8')

      // Check for completion indicators
      const hasConclusion = content.includes('## Conclusion') || content.includes('## Summary')
      const hasSuccessCriteria = content.includes('Success Criteria') || content.includes('Definition of Done')
      const hasImplementation = content.includes('## Implementation') || content.includes('## Solution')

      // Check for quality indicators
      const hasRequirements = content.includes('## Requirements') || content.includes('## Must Do')
      const hasRisks = content.includes('## Risks') || content.includes('## Considerations')

      return hasConclusion && hasSuccessCriteria && hasImplementation && hasRequirements && hasRisks
    } catch {
      return false
    }
  }

  private isPlanReadyForImplementation(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf8')

      // Check for approval indicators
      const hasApproval = content.includes('APPROVED') || content.includes('approved')
      const hasImplementation = content.includes('## Implementation Plan') || content.includes('## Execution Plan')

      return hasApproval && hasImplementation
    } catch {
      return false
    }
  }

  private isImplementationReadyForArchive(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf8')

      // Check for completion indicators
      const hasValidation = content.includes('## Validation') || content.includes('## Testing')
      const hasSuccess = content.includes('SUCCESS') || content.includes('COMPLETED') || content.includes('🎉')

      return hasValidation && hasSuccess
    } catch {
      return false
    }
  }

  private promoteToPlan(analysisPath: string): void {
    const fileName = basename(analysisPath, '.md')
    const project = this.extractProjectName(fileName)
    const newFileName = this.generateStandardName(project, 'plan', 'approved')
    const newPath = join(this.plansDir, newFileName)

    renameSync(analysisPath, newPath)
    console.log(`📋 Promoted analysis to plan: ${fileName} → ${newFileName}`)
  }

  private promoteToImplementation(planPath: string): void {
    const fileName = basename(planPath, '.md')
    const project = this.extractProjectName(fileName)
    const newFileName = this.generateStandardName(project, 'implementation', 'in-progress')
    const newPath = join(this.implementationsDir, newFileName)

    renameSync(planPath, newPath)
    console.log(`🚀 Promoted plan to implementation: ${fileName} → ${newFileName}`)
  }

  private archiveImplementation(implementationPath: string): void {
    const fileName = basename(implementationPath, '.md')
    const project = this.extractProjectName(fileName)
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const archiveDir = join(this.archivesDir, `${timestamp}-${project}-complete`)

    // Create archive directory
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true })
    }

    // Move implementation file
    const archivedImplementation = join(archiveDir, `implementation.md`)
    renameSync(implementationPath, archivedImplementation)

    // Try to find and move related files
    this.archiveRelatedFiles(project, archiveDir)

    // Create metadata
    this.createArchiveMetadata(archiveDir, project)

    console.log(`📦 Archived implementation: ${fileName} → ${archiveDir}`)
  }

  private archiveRelatedFiles(project: string, archiveDir: string): void {
    // Look for related analysis, plan, review files
    const patterns = [
      { dir: this.analysesDir, type: 'analysis' },
      { dir: this.plansDir, type: 'plan' },
      { dir: this.reviewsDir, type: 'review' }
    ]

    for (const pattern of patterns) {
      if (existsSync(pattern.dir)) {
        const files = readdirSync(pattern.dir)
          .filter(file => file.includes(project) && file.endsWith('.md'))

        for (const file of files) {
          const srcPath = join(pattern.dir, file)
          const destPath = join(archiveDir, `${pattern.type}.md`)
          try {
            renameSync(srcPath, destPath)
            console.log(`  📄 Archived ${pattern.type}: ${file}`)
          } catch (error) {
            console.log(`  ⚠️  Could not archive ${pattern.type}: ${file}`)
          }
        }
      }
    }
  }

  private createArchiveMetadata(archiveDir: string, project: string): void {
    const metadata = {
      project,
      archivedAt: new Date().toISOString(),
      type: 'complete',
      files: readdirSync(archiveDir).filter(file => file.endsWith('.md')),
      checksums: {} // Could add file checksums here
    }

    writeFileSync(join(archiveDir, 'metadata.json'), JSON.stringify(metadata, null, 2))
  }

  private extractProjectName(fileName: string): string {
    // Extract project name from filename
    // Examples: "2024-01-27-validation-fixes-analysis-pending.md" -> "validation-fixes"
    const parts = fileName.split('-')
    if (parts.length >= 3) {
      // Skip date (first 3 parts) and type/status (last 2 parts)
      return parts.slice(3, -2).join('-')
    }
    return 'unknown-project'
  }

  private generateStandardName(project: string, type: string, status: string): string {
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    return `${timestamp}-${project}-${type}-${status}.md`
  }

  getFileMetadata(): FileMetadata[] {
    const metadata: FileMetadata[] = []

    const dirs = [
      { path: this.analysesDir, type: 'analysis' as const },
      { path: this.plansDir, type: 'plan' as const },
      { path: this.implementationsDir, type: 'implementation' as const },
      { path: this.reviewsDir, type: 'review' as const }
    ]

    for (const dir of dirs) {
      if (!existsSync(dir.path)) continue

      const files = readdirSync(dir.path)
        .filter(file => file.endsWith('.md'))
        .map(file => join(dir.path, file))

      for (const filePath of files) {
        try {
          const stat = statSync(filePath)
          const fileName = basename(filePath, '.md')
          const project = this.extractProjectName(fileName)

          // Determine status from filename
          let status: 'pending' | 'approved' | 'completed' | 'archived' = 'pending'
          if (fileName.includes('approved')) status = 'approved'
          else if (fileName.includes('completed') || fileName.includes('complete')) status = 'completed'
          else if (fileName.includes('archived')) status = 'archived'

          metadata.push({
            path: filePath,
            name: fileName,
            type: dir.type,
            status,
            project,
            created: stat.birthtime,
            modified: stat.mtime,
            size: stat.size
          })
        } catch (error) {
          console.log(`⚠️  Could not read metadata for ${filePath}`)
        }
      }
    }

    return metadata
  }

  generateIndex(): void {
    const metadata = this.getFileMetadata()
    const indexPath = join(this.docsDir, 'FILE_INDEX.md')

    let index = '# Documentation File Index\n\n'
    index += `Generated: ${new Date().toISOString()}\n\n`
    index += `Total Files: ${metadata.length}\n\n`

    const byType = metadata.reduce((acc, file) => {
      if (!acc[file.type]) acc[file.type] = []
      acc[file.type].push(file)
      return acc
    }, {} as Record<string, FileMetadata[]>)

    for (const [type, files] of Object.entries(byType)) {
      index += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s (${files.length})\n\n`

      for (const file of files) {
        const relativePath = file.path.replace(this.docsDir, 'docs')
        index += `- **${file.name}**\n`
        index += `  - Project: ${file.project}\n`
        index += `  - Status: ${file.status}\n`
        index += `  - Modified: ${file.modified.toISOString().split('T')[0]}\n`
        index += `  - Path: ${relativePath}\n\n`
      }
    }

    writeFileSync(indexPath, index)
    console.log(`📋 Generated file index: ${indexPath}`)
  }

  searchFiles(query: string, options: {
    type?: 'analysis' | 'plan' | 'implementation' | 'review'
    status?: 'pending' | 'approved' | 'completed' | 'archived'
    project?: string
    dateFrom?: Date
    dateTo?: Date
  } = {}): FileMetadata[] {
    let metadata = this.getFileMetadata()

    // Filter by type
    if (options.type) {
      metadata = metadata.filter(file => file.type === options.type)
    }

    // Filter by status
    if (options.status) {
      metadata = metadata.filter(file => file.status === options.status)
    }

    // Filter by project
    if (options.project) {
      metadata = metadata.filter(file =>
        file.project.toLowerCase().includes(options.project!.toLowerCase())
      )
    }

    // Filter by date range
    if (options.dateFrom) {
      metadata = metadata.filter(file => file.modified >= options.dateFrom!)
    }
    if (options.dateTo) {
      metadata = metadata.filter(file => file.modified <= options.dateTo!)
    }

    // Filter by text search
    if (query) {
      metadata = metadata.filter(file => {
        const content = readFileSync(file.path, 'utf8').toLowerCase()
        return content.includes(query.toLowerCase()) ||
               file.name.toLowerCase().includes(query.toLowerCase()) ||
               file.project.toLowerCase().includes(query.toLowerCase())
      })
    }

    return metadata
  }

  cleanupOldFiles(daysOld: number = 90): void {
    console.log(`🧹 Cleaning up files older than ${daysOld} days...`)

    const metadata = this.getFileMetadata()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    let cleanedCount = 0

    for (const file of metadata) {
      if (file.modified < cutoffDate && file.status === 'completed') {
        try {
          // Move to archives with timestamp
          const archiveName = `${file.modified.toISOString().split('T')[0]}-${file.project}-archived-${file.type}.md`
          const archivePath = join(this.archivesDir, archiveName)

          renameSync(file.path, archivePath)
          cleanedCount++
          console.log(`  📦 Archived old file: ${file.name}`)
        } catch (error) {
          console.log(`  ⚠️  Could not archive ${file.name}: ${error}`)
        }
      }
    }

    console.log(`✅ Cleanup complete: ${cleanedCount} files archived`)
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const manager = new FileManager()

  if (args.length === 0) {
    console.log('File Manager - Automated file lifecycle management')
    console.log('=================================================\n')
    console.log('Commands:')
    console.log('  init          - Initialize directory structure')
    console.log('  organize      - Scan and organize files automatically')
    console.log('  index         - Generate file index')
    console.log('  status        - Show current file status')
    console.log('  search <query> [options] - Search files by content/project')
    console.log('    Options: --type=analysis|plan|implementation|review')
    console.log('             --status=pending|approved|completed|archived')
    console.log('             --project=<name>')
    console.log('  cleanup [days] - Archive files older than N days (default: 90)')
    return
  }

  const command = args[0]

  switch (command) {
    case 'init':
      manager.initialize()
      console.log('✅ Directory structure initialized')
      break

    case 'organize':
      manager.initialize() // Ensure dirs exist
      manager.scanAndOrganize()
      break

    case 'index':
      manager.generateIndex()
      break

    case 'status':
      const metadata = manager.getFileMetadata()
      console.log(`📊 File Status (${metadata.length} files):`)

      const byStatus = metadata.reduce((acc, file) => {
        if (!acc[file.status]) acc[file.status] = 0
        acc[file.status]++
        return acc
      }, {} as Record<string, number>)

      for (const [status, count] of Object.entries(byStatus)) {
        console.log(`  ${status}: ${count} files`)
      }
      break

    case 'search':
      const searchQuery = args[1] || ''
      const searchOptions: any = {}

      // Parse additional arguments
      for (let i = 2; i < args.length; i++) {
        const arg = args[i]
        if (arg.startsWith('--type=')) {
          searchOptions.type = arg.split('=')[1]
        } else if (arg.startsWith('--status=')) {
          searchOptions.status = arg.split('=')[1]
        } else if (arg.startsWith('--project=')) {
          searchOptions.project = arg.split('=')[1]
        }
      }

      const searchResults = manager.searchFiles(searchQuery, searchOptions)
      console.log(`🔍 Search Results (${searchResults.length} files):`)

      if (searchResults.length === 0) {
        console.log('  No files found matching criteria')
      } else {
        for (const file of searchResults) {
          console.log(`  📄 ${file.name} (${file.type}, ${file.status}) - ${file.project}`)
        }
      }
      break

    case 'cleanup':
      const daysOld = args[1] ? parseInt(args[1]) : 90
      manager.cleanupOldFiles(daysOld)
      break

    default:
      console.log(`❌ Unknown command: ${command}`)
      process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}