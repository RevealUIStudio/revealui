#!/usr/bin/env node
/**
 * Archive Manager - Project Archiving System
 *
 * Archives successful projects with full context:
 * - analysis, plan, implementation, review
 * - validation snapshots
 * - metadata and metrics
 * - searchable index
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, extname, join } from 'node:path'

interface ArchiveMetadata {
  project: string
  archivedAt: string
  type: 'complete' | 'partial' | 'failed'
  files: string[]
  metrics: {
    totalSize: number
    fileCount: number
    generationTime?: string
    validationStatus: 'passed' | 'failed' | 'unknown'
  }
  checksums: Record<string, string>
}

interface ArchiveIndex {
  lastUpdated: string
  totalArchives: number
  projects: Record<
    string,
    {
      name: string
      archivedAt: string
      type: string
      path: string
      size: number
    }
  >
}

export class ArchiveManager {
  private archivesDir: string
  private indexFile: string

  constructor() {
    this.archivesDir = join(process.cwd(), 'docs', 'archives')
    this.indexFile = join(this.archivesDir, 'ARCHIVE_INDEX.json')
  }

  archiveProject(projectName: string): string {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const archiveDir = join(this.archivesDir, `${timestamp}-${projectName}-complete`)

    console.log(`📦 Archiving project: ${projectName}`)
    console.log(`📁 Archive location: ${archiveDir}`)

    // Create archive directory
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true })
    }

    // Collect and copy project files
    const collectedFiles = this.collectProjectFiles(projectName, archiveDir)

    // Generate metadata
    const metadata = this.generateMetadata(projectName, collectedFiles)
    writeFileSync(join(archiveDir, 'metadata.json'), JSON.stringify(metadata, null, 2))

    // Update archive index
    this.updateIndex(projectName, archiveDir, metadata)

    console.log(
      `✅ Archived ${collectedFiles.length} files (${this.formatBytes(metadata.metrics.totalSize)})`,
    )
    console.log(`📋 Metadata saved to: ${join(archiveDir, 'metadata.json')}`)

    return archiveDir
  }

  private collectProjectFiles(projectName: string, archiveDir: string): string[] {
    const collectedFiles: string[] = []

    // Source directories to check
    const sourceDirs = [
      { path: join(process.cwd(), 'docs', 'analyses'), type: 'analysis' },
      { path: join(process.cwd(), 'docs', 'plans'), type: 'plan' },
      { path: join(process.cwd(), 'docs', 'implementations'), type: 'implementation' },
      { path: join(process.cwd(), 'docs', 'reviews'), type: 'review' },
    ]

    // Validation snapshots
    const validationFiles = ['validation-report.json', 'automation-component-audit.json']

    for (const sourceDir of sourceDirs) {
      if (!existsSync(sourceDir.path)) continue

      const files = readdirSync(sourceDir.path).filter(
        (file) => file.includes(projectName) && file.endsWith('.md'),
      )

      for (const file of files) {
        const srcPath = join(sourceDir.path, file)
        const destPath = join(archiveDir, `${sourceDir.type}.md`)

        try {
          copyFileSync(srcPath, destPath)
          collectedFiles.push(destPath)
          console.log(`  📄 Archived ${sourceDir.type}: ${file}`)
        } catch (error) {
          console.log(`  ⚠️  Failed to archive ${file}: ${error.message}`)
        }
      }
    }

    // Copy validation snapshots
    for (const validationFile of validationFiles) {
      const srcPath = join(process.cwd(), validationFile)
      if (existsSync(srcPath)) {
        const destPath = join(archiveDir, validationFile)
        try {
          copyFileSync(srcPath, destPath)
          collectedFiles.push(destPath)
          console.log(`  📊 Archived validation: ${validationFile}`)
        } catch (error) {
          console.log(`  ⚠️  Failed to archive ${validationFile}: ${error.message}`)
        }
      }
    }

    // Copy any automation state files
    const automationFiles = readdirSync(process.cwd()).filter(
      (file) => file.startsWith('automation-') && file.endsWith('.json'),
    )

    for (const automationFile of automationFiles) {
      if (automationFile.includes(projectName.replace(/[^a-zA-Z0-9]/g, ''))) {
        const srcPath = join(process.cwd(), automationFile)
        const destPath = join(archiveDir, automationFile)
        try {
          copyFileSync(srcPath, destPath)
          collectedFiles.push(destPath)
          console.log(`  🤖 Archived automation state: ${automationFile}`)
        } catch (error) {
          console.log(`  ⚠️  Failed to archive ${automationFile}: ${error.message}`)
        }
      }
    }

    return collectedFiles
  }

  private generateMetadata(projectName: string, files: string[]): ArchiveMetadata {
    let totalSize = 0
    const checksums: Record<string, string> = {}
    const fileList: string[] = []

    for (const filePath of files) {
      try {
        const stat = statSync(filePath)
        totalSize += stat.size
        fileList.push(basename(filePath))

        // Simple checksum (in real implementation, use proper hashing)
        const content = readFileSync(filePath, 'utf8')
        const checksum = this.simpleHash(content)
        checksums[basename(filePath)] = checksum.toString()
      } catch (error) {
        console.log(`⚠️  Could not process ${filePath} for metadata`)
      }
    }

    // Determine validation status
    let validationStatus: 'passed' | 'failed' | 'unknown' = 'unknown'
    const reviewFile = files.find((f) => basename(f) === 'review.md')
    if (reviewFile) {
      try {
        const reviewContent = readFileSync(reviewFile, 'utf8')
        if (
          reviewContent.includes('✅ SUCCESS') ||
          reviewContent.includes('GENERATION SUCCESSFUL')
        ) {
          validationStatus = 'passed'
        } else if (
          reviewContent.includes('❌ ISSUES') ||
          reviewContent.includes('GENERATION REQUIRES')
        ) {
          validationStatus = 'failed'
        }
      } catch {
        // Keep as unknown
      }
    }

    return {
      project: projectName,
      archivedAt: new Date().toISOString(),
      type: 'complete',
      files: fileList,
      metrics: {
        totalSize,
        fileCount: files.length,
        validationStatus,
      },
      checksums,
    }
  }

  private updateIndex(projectName: string, archiveDir: string, metadata: ArchiveMetadata): void {
    let index: ArchiveIndex = {
      lastUpdated: new Date().toISOString(),
      totalArchives: 0,
      projects: {},
    }

    // Load existing index if it exists
    if (existsSync(this.indexFile)) {
      try {
        index = JSON.parse(readFileSync(this.indexFile, 'utf8'))
      } catch (error) {
        console.log(`⚠️  Could not load existing index: ${error.message}`)
      }
    }

    // Add new project
    const projectKey = `${metadata.archivedAt.split('T')[0]}-${projectName}`
    index.projects[projectKey] = {
      name: projectName,
      archivedAt: metadata.archivedAt,
      type: metadata.type,
      path: archiveDir,
      size: metadata.metrics.totalSize,
    }

    index.lastUpdated = new Date().toISOString()
    index.totalArchives = Object.keys(index.projects).length

    // Save updated index
    writeFileSync(this.indexFile, JSON.stringify(index, null, 2))
    console.log(`📋 Updated archive index: ${this.indexFile}`)
  }

  generateIndexMarkdown(): void {
    const indexPath = join(this.archivesDir, 'ARCHIVE_INDEX.md')

    if (!existsSync(this.indexFile)) {
      console.log('No archive index found')
      return
    }

    const index: ArchiveIndex = JSON.parse(readFileSync(this.indexFile, 'utf8'))

    let markdown = '# 📦 Project Archives Index\n\n'
    markdown += `**Last Updated:** ${index.lastUpdated}\n`
    markdown += `**Total Archives:** ${index.totalArchives}\n\n`

    markdown += '## 📋 Archived Projects\n\n'
    markdown += '| Project | Archived | Type | Size | Path |\n'
    markdown += '|---------|----------|------|------|------|\n'

    for (const [key, project] of Object.entries(index.projects)) {
      const size = this.formatBytes(project.size)
      const date = project.archivedAt.split('T')[0]
      const relativePath = project.path.replace(process.cwd(), '.')
      markdown += `| ${project.name} | ${date} | ${project.type} | ${size} | \`${relativePath}\` |\n`
    }

    markdown += '\n## 🔍 Search & Discovery\n\n'
    markdown += 'Use the JSON index file for programmatic access:\n'
    markdown += '```bash\n'
    markdown +=
      'cat docs/archives/ARCHIVE_INDEX.json | jq ".projects[] | select(.name | contains(\\"automation\\"))"\n'
    markdown += '```\n\n'

    markdown += '---\n'
    markdown += '*Generated automatically by archive manager*'

    writeFileSync(indexPath, markdown)
    console.log(`📄 Generated markdown index: ${indexPath}`)
  }

  private simpleHash(content: string): number {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i]
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('Archive Manager - Project archiving system')
    console.log('=========================================\n')
    console.log('Commands:')
    console.log('  archive <project-name>    - Archive a completed project')
    console.log('  index                     - Generate markdown index')
    console.log('  list                      - List all archived projects')
    console.log('\nExamples:')
    console.log('  archive-manager archive automation-infrastructure')
    console.log('  archive-manager index')
    return
  }

  const command = args[0]
  const manager = new ArchiveManager()

  switch (command) {
    case 'archive': {
      if (args.length < 2) {
        console.log('❌ Error: archive requires project name')
        console.log('Usage: archive-manager archive <project-name>')
        process.exit(1)
      }
      const projectName = args[1]
      manager.archiveProject(projectName)
      break
    }

    case 'index':
      manager.generateIndexMarkdown()
      break

    case 'list':
      if (existsSync(manager['indexFile'])) {
        const index = JSON.parse(readFileSync(manager['indexFile'], 'utf8'))
        console.log('📦 Archived Projects:')
        for (const [key, project] of Object.entries(index.projects)) {
          console.log(`  • ${project.name} (${project.archivedAt.split('T')[0]})`)
        }
      } else {
        console.log('No archives found')
      }
      break

    default:
      console.log(`❌ Unknown command: ${command}`)
      process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
