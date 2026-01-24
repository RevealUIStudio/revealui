#!/usr/bin/env tsx

/**
 * Package README Generator
 *
 * Auto-generates README files for packages based on package.json metadata
 * and API documentation.
 *
 * Usage:
 *   pnpm docs:generate:readme
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface PackageInfo {
  name: string
  version: string
  description?: string
  packagePath: string
  readmePath: string
  hasApiDocs: boolean
}

async function findPackages(): Promise<PackageInfo[]> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const packageFiles = await fg(['**/package.json'], {
    cwd: projectRoot,
    ignore: ['node_modules/**', 'dist/**', '.next/**'],
  })

  const packages: PackageInfo[] = []

  for (const packageFile of packageFiles) {
    const packagePath = path.dirname(packageFile)
    const packageJsonPath = path.join(projectRoot, packageFile)

    // Skip root package.json
    if (packagePath === '.') continue

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

      // Only process packages (not apps)
      if (packageJson.private && !packageJson.name?.startsWith('@revealui/')) {
        continue
      }

      const packageName = packageJson.name || path.basename(packagePath)
      const apiDocsPath = path.join(
        projectRoot,
        'docs/api',
        packageName.replace('@', '').replace('/', '-'),
        'README.md',
      )

      packages.push({
        name: packageName,
        version: packageJson.version || '0.0.0',
        description: packageJson.description,
        packagePath,
        readmePath: path.join(projectRoot, packagePath, 'README.md'),
        hasApiDocs: await fileExists(apiDocsPath),
      })
    } catch (error) {
      logger.warning(
        `Failed to read ${packageFile}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return packages
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function generatePackageReadme(pkg: PackageInfo): string {
  let readme = ''

  // Title
  readme += `# ${pkg.name}\n\n`

  // Description
  if (pkg.description) {
    readme += `${pkg.description}\n\n`
  }

  // Version
  readme += `**Version**: ${pkg.version}\n\n`

  // Installation
  readme += `## Installation\n\n`
  readme += `\`\`\`bash\n`
  readme += `pnpm add ${pkg.name}\n`
  readme += `\`\`\`\n\n`

  // Usage
  readme += `## Usage\n\n`
  readme += `\`\`\`typescript\n`
  readme += `import { ... } from '${pkg.name}'\n`
  readme += `\`\`\`\n\n`

  // API Documentation
  if (pkg.hasApiDocs) {
    readme += `## API Documentation\n\n`
    readme += `See [API Documentation](../../docs/api/${pkg.name.replace('@', '').replace('/', '-')}/README.md) for complete API reference.\n\n`
  }

  // Package Info
  readme += `---\n\n`
  readme += `*This README is auto-generated. For API documentation, see the [API docs](../../docs/api/).*\n\n`

  // Related Documentation section (new documentation friendliness strategy)
  readme += `## Related Documentation\n\n`
  readme += `- [Main Documentation Index](../../docs/README.md) - Documentation overview\n`
  readme += `- [Master Index](../../docs/INDEX.md) - Complete documentation index\n`
  readme += `- [Task-Based Guide](../../docs/TASKS.md) - Find docs by task\n`
  readme += `- [Keywords Index](../../docs/KEYWORDS.md) - Search by keyword\n`
  readme += `- [Status Dashboard](../../docs/STATUS.md) - Current project state\n`

  return readme
}

async function generatePackageReadmes(): Promise<void> {
  const _projectRoot = await getProjectRoot(import.meta.url)

  logger.header('Package README Generation')

  const packages = await findPackages()
  logger.info(`Found ${packages.length} packages to process\n`)

  let generated = 0
  let skipped = 0

  for (const pkg of packages) {
    try {
      // Check if README already exists and is not auto-generated
      const existingReadme = await fileExists(pkg.readmePath)
      if (existingReadme) {
        const content = await fs.readFile(pkg.readmePath, 'utf-8')
        // Skip if it doesn't have the auto-generated marker
        if (!content.includes('auto-generated')) {
          logger.info(`  ⏭️  Skipping ${pkg.name} (has custom README)`)
          skipped++
          continue
        }
      }

      const readme = generatePackageReadme(pkg)
      await fs.writeFile(pkg.readmePath, readme, 'utf-8')
      logger.success(`  ✅ Generated: ${pkg.name}`)
      generated++
    } catch (error) {
      logger.error(
        `  ❌ Failed to generate ${pkg.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  logger.info(`\n\nPackage README generation complete!`)
  logger.info(`  Generated: ${generated}`)
  logger.info(`  Skipped: ${skipped}`)
}

async function main() {
  try {
    await generatePackageReadmes()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
