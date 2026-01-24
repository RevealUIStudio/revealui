#!/usr/bin/env tsx

/**
 * API Documentation Template Generator
 *
 * Generates markdown documentation from extracted API entities.
 */

import type { ApiEntity, PackageApi } from './api-doc-extractor.js'

export function generateEntityMarkdown(entity: ApiEntity): string {
  let markdown = ''

  // Header
  const headerLevel = '##'
  markdown += `${headerLevel} ${entity.name}\n\n`

  // Deprecated notice
  if (entity.deprecated) {
    markdown += `> **⚠️ Deprecated**: ${entity.deprecated}\n\n`
  }

  // Description
  if (entity.description) {
    markdown += `${entity.description}\n\n`
  }

  // Kind badge
  markdown += `**Kind**: \`${entity.kind}\`\n\n`

  // Signature
  if (entity.signature) {
    markdown += `### Signature\n\n`
    markdown += `\`\`\`typescript\n${entity.signature}\n\`\`\`\n\n`
  }

  // Parameters
  if (entity.parameters && entity.parameters.length > 0) {
    markdown += `### Parameters\n\n`
    markdown += `| Name | Type | Optional | Description |\n`
    markdown += `|------|------|----------|-------------|\n`

    for (const param of entity.parameters) {
      markdown += `| \`${param.name}\` | \`${escapeMarkdown(param.type)}\` | ${param.optional ? 'Yes' : 'No'} | ${param.description || ''} |\n`
    }

    markdown += `\n`
  }

  // Returns
  if (entity.returns) {
    markdown += `### Returns\n\n`
    markdown += `**Type**: \`${escapeMarkdown(entity.returns.type)}\`\n\n`
    if (entity.returns.description) {
      markdown += `${entity.returns.description}\n\n`
    }
  }

  // Examples
  if (entity.examples && entity.examples.length > 0) {
    markdown += `### Examples\n\n`
    for (const example of entity.examples) {
      markdown += `\`\`\`typescript\n${example}\n\`\`\`\n\n`
    }
  }

  // Since
  if (entity.since) {
    markdown += `**Since**: ${entity.since}\n\n`
  }

  // See also
  if (entity.see && entity.see.length > 0) {
    markdown += `### See Also\n\n`
    for (const see of entity.see) {
      markdown += `- ${see}\n`
    }
    markdown += `\n`
  }

  // Source location
  markdown += `---\n\n`
  markdown += `*Defined in: \`${entity.file}\` (line ${entity.line})*\n\n`

  return markdown
}

export function generatePackageMarkdown(packageApi: PackageApi): string {
  let markdown = ''

  // Package header
  markdown += `# ${packageApi.packageName} API Reference\n\n`
  markdown += `*Auto-generated API documentation*\n\n`
  markdown += `**Last Updated**: ${new Date().toISOString().split('T')[0]}\n\n`
  markdown += `---\n\n`

  // Navigation links (new documentation friendliness strategy)
  markdown += `## Navigation\n\n`
  markdown += `- [Main Documentation Index](../../README.md) - Documentation overview\n`
  markdown += `- [Master Index](../../INDEX.md) - Complete documentation index\n`
  markdown += `- [Task-Based Guide](../../TASKS.md) - Find docs by task\n`
  markdown += `- [Keywords Index](../../KEYWORDS.md) - Search by keyword\n`
  markdown += `- [Status Dashboard](../../STATUS.md) - Current project state\n\n`
  markdown += `---\n\n`

  // Overview
  markdown += `## Overview\n\n`
  markdown += `This package exports ${packageApi.entities.length} public API entities.\n\n`

  // Table of contents
  if (packageApi.entities.length > 0) {
    markdown += `## Table of Contents\n\n`

    // Group by kind
    const byKind = new Map<string, ApiEntity[]>()
    for (const entity of packageApi.entities) {
      if (!byKind.has(entity.kind)) {
        byKind.set(entity.kind, [])
      }
      byKind.get(entity.kind)!.push(entity)
    }

    for (const [kind, entities] of Array.from(byKind.entries()).sort()) {
      markdown += `\n### ${kind.charAt(0).toUpperCase() + kind.slice(1)}s\n\n`
      for (const entity of entities.sort((a, b) => a.name.localeCompare(b.name))) {
        markdown += `- [${entity.name}](#${entity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')})\n`
      }
    }

    markdown += `\n---\n\n`

    // Generate entity documentation
    for (const [kind, entities] of Array.from(byKind.entries()).sort()) {
      markdown += `## ${kind.charAt(0).toUpperCase() + kind.slice(1)}s\n\n`
      for (const entity of entities.sort((a, b) => a.name.localeCompare(b.name))) {
        markdown += generateEntityMarkdown(entity)
        markdown += `\n`
      }
    }
  } else {
    markdown += `No public API entities found.\n\n`
  }

  return markdown
}

export function generateIndexMarkdown(packages: PackageApi[]): string {
  let markdown = ''

  markdown += `# API Documentation Index\n\n`
  markdown += `*Auto-generated API documentation for all packages*\n\n`
  markdown += `**Last Updated**: ${new Date().toISOString().split('T')[0]}\n\n`
  markdown += `---\n\n`

  // Navigation links (new documentation friendliness strategy)
  markdown += `## Navigation\n\n`
  markdown += `- [Main Documentation Index](../README.md) - Documentation overview\n`
  markdown += `- [Master Index](../INDEX.md) - Complete documentation index\n`
  markdown += `- [Task-Based Guide](../TASKS.md) - Find docs by task\n`
  markdown += `- [Keywords Index](../KEYWORDS.md) - Search by keyword\n`
  markdown += `- [Status Dashboard](../STATUS.md) - Current project state\n\n`
  markdown += `---\n\n`

  markdown += `## Packages\n\n`

  for (const pkg of packages.sort((a, b) => a.packageName.localeCompare(b.packageName))) {
    const entityCount = pkg.entities.length
    markdown += `### [${pkg.packageName}](./${pkg.packageName}/README.md)\n\n`
    markdown += `- **Entities**: ${entityCount}\n`
    markdown += `- **Path**: \`${pkg.packagePath}\`\n\n`
  }

  markdown += `---\n\n`
  markdown += `*This documentation is auto-generated from TypeScript source files.*\n\n`

  // Related Documentation section (new documentation friendliness strategy)
  markdown += `## Related Documentation\n\n`
  markdown += `- [Main Documentation Index](../README.md) - Documentation overview\n`
  markdown += `- [Master Index](../INDEX.md) - Complete documentation index\n`
  markdown += `- [Task-Based Guide](../TASKS.md) - Find docs by task\n`
  markdown += `- [Keywords Index](../KEYWORDS.md) - Search by keyword\n`
  markdown += `- [Status Dashboard](../STATUS.md) - Current project state\n`

  return markdown
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}
