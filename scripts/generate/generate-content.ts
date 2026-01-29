#!/usr/bin/env tsx

/**
 * Documentation Content Generation Tool
 *
 * Consolidated tool for documentation generation and quality analysis:
 * - api      - Generate OpenAPI spec from route files
 * - readme   - Generate package READMEs
 * - site     - Build documentation site
 * - extract  - Extract JSDoc documentation
 * - workflow - Run documentation quality assessment workflow
 *
 * Usage:
 *   pnpm tsx scripts/engineer/generation/generate-content.ts api
 *   pnpm tsx scripts/engineer/generation/generate-content.ts readme
 *   pnpm tsx scripts/engineer/generation/generate-content.ts site
 *   pnpm tsx scripts/engineer/generation/generate-content.ts extract
 *   pnpm tsx scripts/engineer/generation/generate-content.ts workflow
 */

import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'
import { createLogger, getProjectRoot, fileExists } from '../../lib/index.js'

const logger = createLogger({ prefix: 'DocGen' })

interface APIEndpoint {
  path: string
  method: string
  description: string
  parameters?: unknown[]
  responses?: unknown[]
}

interface PackageJson {
  name?: string
  version?: string
  description?: string
  exports?: Record<string, string>
  dependencies?: Record<string, string>
}

interface ExtractedDoc {
  file: string
  description: string
  type: 'jsdoc'
}

interface OpenApiOperation {
  summary: string
  responses: {
    '200': {
      description: string
    }
  }
}

type OpenApiPaths = Record<string, Record<string, OpenApiOperation>>

interface OpenApiSpec {
  openapi: string
  info: {
    title: string
    version: string
    description: string
  }
  paths: OpenApiPaths
}

interface AssessmentResult {
  category: string
  score: number
  issues: string[]
  recommendations: string[]
}

interface DocumentationAssessment {
  overall: number
  results: AssessmentResult[]
  missingDocs: string[]
  brokenLinks: string[]
  timestamp: Date
}

async function generateAPIDocs(): Promise<void> {
  logger.header('Generating API Documentation')

  const projectRoot = await getProjectRoot(import.meta.url)
  const apiDir = join(projectRoot, 'apps', 'cms', 'src', 'app', 'api')

  try {
    if (!(await fileExists(apiDir))) {
      logger.warn('API directory not found, skipping API docs generation')
      return
    }

    const endpoints = await extractAPIEndpoints(apiDir)
    const openAPISpec = await generateOpenAPISpec(endpoints)

    const outputPath = join(projectRoot, 'docs', 'api', 'generated-openapi.json')
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, JSON.stringify(openAPISpec, null, 2))

    logger.success(`Generated OpenAPI spec with ${endpoints.length} endpoints`)
    logger.info(`Output: docs/api/generated-openapi.json`)
  } catch (error) {
    logger.error(`API documentation generation failed: ${error}`)
  }
}

async function extractAPIEndpoints(apiDir: string): Promise<APIEndpoint[]> {
  const endpoints: APIEndpoint[] = []

  async function scan(dir: string, currentPath = ''): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // Handle dynamic route segments
        let segment = entry.name
        if (segment.startsWith('[') && segment.endsWith(']')) {
          segment = `{${segment.slice(1, -1)}}`
        }
        const newPath = `${currentPath}/${segment}`
        await scan(fullPath, newPath)
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        const endpointPath = currentPath || '/'
        const methods = await extractRouteMethods(fullPath)

        for (const method of methods) {
          endpoints.push({
            path: endpointPath,
            method,
            description: `API endpoint: ${method} ${endpointPath}`,
          })
        }
      }
    }
  }

  await scan(apiDir)
  return endpoints
}

async function extractRouteMethods(routeFile: string): Promise<string[]> {
  try {
    const content = await readFile(routeFile, 'utf-8')
    const methods: string[] = []

    // Check for common HTTP method exports
    const methodPatterns = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
    for (const method of methodPatterns) {
      // Check for both named exports and default exports
      if (
        content.includes(`export async function ${method}`) ||
        content.includes(`export function ${method}`) ||
        content.includes(`export const ${method}`)
      ) {
        methods.push(method)
      }
    }

    return methods
  } catch {
    return []
  }
}

async function generateOpenAPISpec(endpoints: APIEndpoint[]): Promise<OpenApiSpec> {
  const paths: OpenApiPaths = {}

  for (const endpoint of endpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {}
    }
    paths[endpoint.path][endpoint.method.toLowerCase()] = {
      summary: endpoint.description,
      responses: {
        '200': {
          description: 'Success',
        },
      },
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'RevealUI API',
      version: '1.0.0',
      description: 'Generated API documentation for RevealUI CMS',
    },
    paths,
  }
}

async function generatePackageReadmes(): Promise<void> {
  logger.header('Generating Package READMEs')

  const projectRoot = await getProjectRoot(import.meta.url)
  const packagesDir = join(projectRoot, 'packages')

  try {
    const entries = await readdir(packagesDir, { withFileTypes: true })
    const packages = entries.filter((entry) => entry.isDirectory())
    let generatedCount = 0

    for (const pkg of packages) {
      const packagePath = join(packagesDir, pkg.name)
      const packageJsonPath = join(packagePath, 'package.json')

      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as PackageJson
        const readmeContent = generateReadmeContent(packageJson)

        const readmePath = join(packagePath, 'README.md')
        await writeFile(readmePath, readmeContent)

        logger.success(`Generated README for ${packageJson.name}`)
        generatedCount++
      } catch (error) {
        logger.warn(`Failed to generate README for ${pkg.name}: ${error}`)
      }
    }

    logger.success(`Generated READMEs for ${generatedCount}/${packages.length} packages`)
  } catch (error) {
    logger.error(`Package README generation failed: ${error}`)
  }
}

function generateReadmeContent(packageJson: PackageJson): string {
  const name = packageJson.name || 'Unknown Package'
  const description = packageJson.description || 'No description available'
  const version = packageJson.version || '0.0.0'

  let content = `# ${name}

${description}

## Version
${version}

## Installation
\`\`\`bash
pnpm add ${name}
\`\`\`
`

  if (packageJson.exports) {
    content += '\n## Exports\n\n'
    for (const [key, value] of Object.entries(packageJson.exports)) {
      content += `- \`${key}\`: ${value}\n`
    }
  }

  if (packageJson.dependencies) {
    const deps = Object.keys(packageJson.dependencies)
    if (deps.length > 0) {
      content += '\n## Dependencies\n\n'
      deps.forEach((dep) => {
        content += `- ${dep}\n`
      })
    }
  }

  return content
}

async function buildDocsSite(): Promise<void> {
  logger.header('Building Documentation Site')

  const projectRoot = await getProjectRoot(import.meta.url)
  const appsDir = join(projectRoot, 'apps')

  try {
    // Check if docs app exists
    const docsAppDir = join(appsDir, 'docs')
    if (!(await fileExists(docsAppDir))) {
      logger.warn('Docs app not found - skipping site build')
      return
    }

    // Build the docs site
    const { execCommand } = await import('../../lib/exec.js')
    const result = await execCommand('pnpm', ['--filter', 'docs', 'build'], {
      cwd: projectRoot,
    })

    if (result.success) {
      logger.success('Documentation site built successfully')
    } else {
      logger.error(`Docs site build failed: ${result.message}`)
    }
  } catch (error) {
    logger.error(`Documentation site build failed: ${error}`)
  }
}

async function extractAPIDocs(): Promise<void> {
  logger.header('Extracting API Documentation')

  const projectRoot = await getProjectRoot(import.meta.url)
  const sourceDirs = [join(projectRoot, 'apps', 'cms', 'src'), join(projectRoot, 'packages')]

  try {
    const apiDocs: ExtractedDoc[] = []

    for (const sourceDir of sourceDirs) {
      if (await fileExists(sourceDir)) {
        const docs = await extractFromSource(sourceDir, projectRoot)
        apiDocs.push(...docs)
      }
    }

    const outputPath = join(projectRoot, 'docs', 'api', 'extracted-docs.json')
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, JSON.stringify(apiDocs, null, 2))

    logger.success(`Extracted documentation for ${apiDocs.length} API items`)
    logger.info(`Output: docs/api/extracted-docs.json`)
  } catch (error) {
    logger.error(`API documentation extraction failed: ${error}`)
  }
}

async function extractFromSource(sourceDir: string, projectRoot: string): Promise<ExtractedDoc[]> {
  const docs: ExtractedDoc[] = []

  async function scan(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !['node_modules', 'dist', '.next', '.turbo'].includes(entry.name)
      ) {
        await scan(fullPath)
      } else if (entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name))) {
        const fileDocs = await extractFromFile(fullPath, projectRoot)
        docs.push(...fileDocs)
      }
    }
  }

  await scan(sourceDir)
  return docs
}

async function extractFromFile(filePath: string, projectRoot: string): Promise<ExtractedDoc[]> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const docs: ExtractedDoc[] = []

    // Extract JSDoc comments
    const jsdocRegex = /\/\*\*\s*\n(?:\s*\*\s*(.*?)\n)*\s*\*\//g
    let match = jsdocRegex.exec(content)

    while (match !== null) {
      const jsdoc = match[0]
      const description = jsdoc
        .split('\n')
        .filter((line) => line.includes('*'))
        .map((line) => line.replace(/^\s*\*\s*/, '').replace(/\s*$/, ''))
        .join(' ')
        .replace(/\s+@.*$/, '') // Remove @tags

      if (description.trim() && description.length > 10) {
        docs.push({
          file: relative(projectRoot, filePath),
          description: description.trim(),
          type: 'jsdoc',
        })
      }
      match = jsdocRegex.exec(content)
    }

    return docs
  } catch {
    return []
  }
}

async function runAssessmentWorkflow(): Promise<void> {
  logger.header('Running Documentation Assessment Workflow')

  const projectRoot = await getProjectRoot(import.meta.url)
  const assessment: DocumentationAssessment = {
    overall: 0,
    results: [],
    missingDocs: [],
    brokenLinks: [],
    timestamp: new Date(),
  }

  // 1. Check for missing documentation
  logger.info('Checking for missing documentation...')
  const missingDocs = await checkMissingDocs(projectRoot)
  assessment.missingDocs = missingDocs

  if (missingDocs.length > 0) {
    assessment.results.push({
      category: 'Missing Documentation',
      score: Math.max(0, 100 - missingDocs.length * 10),
      issues: missingDocs.map((f) => `Missing README: ${f}`),
      recommendations: ['Add README.md files to undocumented packages'],
    })
    logger.warn(`Found ${missingDocs.length} packages without README`)
  } else {
    assessment.results.push({
      category: 'Missing Documentation',
      score: 100,
      issues: [],
      recommendations: [],
    })
    logger.success('All packages have README files')
  }

  // 2. Check link validity in markdown files
  logger.info('Checking documentation links...')
  const brokenLinks = await checkBrokenLinks(projectRoot)
  assessment.brokenLinks = brokenLinks

  if (brokenLinks.length > 0) {
    assessment.results.push({
      category: 'Link Validation',
      score: Math.max(0, 100 - brokenLinks.length * 5),
      issues: brokenLinks.map((l) => `Broken link: ${l}`),
      recommendations: ['Fix or remove broken links in documentation'],
    })
    logger.warn(`Found ${brokenLinks.length} broken links`)
  } else {
    assessment.results.push({
      category: 'Link Validation',
      score: 100,
      issues: [],
      recommendations: [],
    })
    logger.success('All documentation links are valid')
  }

  // 3. Check API documentation coverage
  logger.info('Checking API documentation coverage...')
  const apiCoverage = await checkAPICoverage(projectRoot)
  assessment.results.push(apiCoverage)

  if (apiCoverage.score < 100) {
    logger.warn(`API documentation coverage: ${apiCoverage.score}%`)
  } else {
    logger.success('API documentation coverage: 100%')
  }

  // 4. Check JSDoc coverage
  logger.info('Checking JSDoc coverage...')
  const jsdocCoverage = await checkJSDocCoverage(projectRoot)
  assessment.results.push(jsdocCoverage)

  if (jsdocCoverage.score < 80) {
    logger.warn(`JSDoc coverage: ${jsdocCoverage.score}%`)
  } else {
    logger.success(`JSDoc coverage: ${jsdocCoverage.score}%`)
  }

  // Calculate overall score
  const totalScore = assessment.results.reduce((sum, r) => sum + r.score, 0)
  assessment.overall = Math.round(totalScore / assessment.results.length)

  // Save assessment report
  const reportPath = join(projectRoot, 'docs', 'assessment-report.json')
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(assessment, null, 2))

  // Print summary
  logger.divider()
  logger.header('Assessment Summary')

  for (const result of assessment.results) {
    const icon = result.score >= 80 ? '[OK]' : result.score >= 50 ? '[WARN]' : '[ERROR]'
    logger.info(`${icon} ${result.category}: ${result.score}%`)
    for (const issue of result.issues.slice(0, 3)) {
      logger.info(`    - ${issue}`)
    }
    if (result.issues.length > 3) {
      logger.info(`    ... and ${result.issues.length - 3} more`)
    }
  }

  logger.divider()
  logger.info(`Overall Documentation Score: ${assessment.overall}%`)
  logger.info(`Report saved to: docs/assessment-report.json`)

  if (assessment.overall < 50) {
    logger.error('Documentation quality is below acceptable threshold')
  } else if (assessment.overall < 80) {
    logger.warn('Documentation needs improvement')
  } else {
    logger.success('Documentation quality is good')
  }
}

async function checkMissingDocs(projectRoot: string): Promise<string[]> {
  const packagesDir = join(projectRoot, 'packages')
  const missing: string[] = []

  try {
    const entries = await readdir(packagesDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const readmePath = join(packagesDir, entry.name, 'README.md')
        if (!(await fileExists(readmePath))) {
          missing.push(entry.name)
        }
      }
    }
  } catch {
    // Packages dir doesn't exist
  }

  return missing
}

async function checkBrokenLinks(projectRoot: string): Promise<string[]> {
  const docsDir = join(projectRoot, 'docs')
  const brokenLinks: string[] = []

  async function scanMarkdown(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          await scanMarkdown(fullPath)
        } else if (entry.name.endsWith('.md')) {
          const content = await readFile(fullPath, 'utf-8')

          // Find markdown links
          const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
          let match = linkRegex.exec(content)

          while (match !== null) {
            const linkPath = match[2]

            // Check relative links
            if (!linkPath.startsWith('http') && !linkPath.startsWith('#')) {
              const absolutePath = join(dirname(fullPath), linkPath.split('#')[0])
              if (!(await fileExists(absolutePath))) {
                brokenLinks.push(`${relative(projectRoot, fullPath)}: ${linkPath}`)
              }
            }
            match = linkRegex.exec(content)
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  await scanMarkdown(docsDir)
  return brokenLinks
}

async function checkAPICoverage(projectRoot: string): Promise<AssessmentResult> {
  const apiDir = join(projectRoot, 'apps', 'cms', 'src', 'app', 'api')
  let totalEndpoints = 0
  let documentedEndpoints = 0
  const undocumented: string[] = []

  async function scan(dir: string, currentPath = ''): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          await scan(fullPath, `${currentPath}/${entry.name}`)
        } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
          const content = await readFile(fullPath, 'utf-8')
          const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

          for (const method of methods) {
            if (
              content.includes(`export async function ${method}`) ||
              content.includes(`export function ${method}`)
            ) {
              totalEndpoints++

              // Check for JSDoc before the function
              const hasJSDoc =
                content.includes(`/**`) && content.indexOf('/**') < content.indexOf(`function ${method}`)

              if (hasJSDoc) {
                documentedEndpoints++
              } else {
                undocumented.push(`${method} ${currentPath}`)
              }
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  await scan(apiDir)

  const score = totalEndpoints > 0 ? Math.round((documentedEndpoints / totalEndpoints) * 100) : 100

  return {
    category: 'API Documentation Coverage',
    score,
    issues: undocumented.map((e) => `Undocumented endpoint: ${e}`),
    recommendations:
      undocumented.length > 0
        ? ['Add JSDoc comments to API route handlers']
        : [],
  }
}

async function checkJSDocCoverage(projectRoot: string): Promise<AssessmentResult> {
  const packagesDir = join(projectRoot, 'packages')
  let totalExports = 0
  let documentedExports = 0
  const undocumented: string[] = []

  async function scanPackage(pkgDir: string, pkgName: string): Promise<void> {
    const srcDir = join(pkgDir, 'src')

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = join(dir, entry.name)

          if (entry.isDirectory() && !['__tests__', 'test', 'tests'].includes(entry.name)) {
            await scanDir(fullPath)
          } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            const content = await readFile(fullPath, 'utf-8')

            // Count exported functions/classes
            const exportMatches = content.match(/export\s+(async\s+)?function\s+\w+|export\s+class\s+\w+/g)
            if (exportMatches) {
              for (const match of exportMatches) {
                totalExports++

                // Check for JSDoc before export
                const exportIndex = content.indexOf(match)
                const beforeExport = content.substring(Math.max(0, exportIndex - 500), exportIndex)

                if (beforeExport.includes('*/')) {
                  documentedExports++
                } else {
                  const funcName = match.match(/(?:function|class)\s+(\w+)/)?.[1] || 'unknown'
                  undocumented.push(`${pkgName}:${funcName}`)
                }
              }
            }
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    await scanDir(srcDir)
  }

  try {
    const entries = await readdir(packagesDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await scanPackage(join(packagesDir, entry.name), entry.name)
      }
    }
  } catch {
    // Packages dir doesn't exist
  }

  const score = totalExports > 0 ? Math.round((documentedExports / totalExports) * 100) : 100

  return {
    category: 'JSDoc Coverage',
    score,
    issues: undocumented.slice(0, 10).map((e) => `Missing JSDoc: ${e}`),
    recommendations:
      undocumented.length > 0
        ? ['Add JSDoc comments to exported functions and classes']
        : [],
  }
}

async function main() {
  try {
    const command = process.argv[2]

    switch (command) {
      case 'api':
        await generateAPIDocs()
        break

      case 'readme':
        await generatePackageReadmes()
        break

      case 'site':
        await buildDocsSite()
        break

      case 'extract':
        await extractAPIDocs()
        break

      case 'workflow':
        await runAssessmentWorkflow()
        break

      default:
        logger.error('Usage: generate-content.ts <command>')
        logger.info('Commands: api, readme, site, extract, workflow')
        process.exit(1)
    }

    logger.success('Content generation completed')
  } catch (error) {
    logger.error(`Content generation failed: ${error}`)
    process.exit(1)
  }
}

main()
