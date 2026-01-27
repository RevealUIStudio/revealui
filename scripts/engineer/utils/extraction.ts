/**
 * Code extraction utilities for Cohesion Engine
 */

import {readFile} from '../../../packages/core/src/.scripts/utils.ts'
import type {CodeLocation,PatternInstance} from '../cohesion/types.ts'

/**
 * Extract code location with context
 */
export async function extractCodeLocation(
  filePath: string,
  line: number,
  contextLines: number = 3,
): Promise<CodeLocation> {
  try {
    const content = await readFile(filePath)
    const lines = content.split('\n')

    const targetLine = lines[line - 1] // Convert to 0-indexed
    const before = lines.slice(Math.max(0, line - 1 - contextLines), line - 1).map((l) => l.trim())
    const after = lines
      .slice(line, Math.min(lines.length, line + contextLines))
      .map((l) => l.trim())

    return {
      file: filePath,
      line,
      code: targetLine.trim(),
      context: before.length > 0 || after.length > 0 ? { before, after } : undefined,
    }
  } catch (_error) {
    // File doesn't exist or can't be read
    return {
      file: filePath,
      line,
      code: '',
    }
  }
}

/**
 * Convert pattern instance to code location
 */
export async function patternInstanceToCodeLocation(
  instance: PatternInstance,
  contextLines: number = 3,
): Promise<CodeLocation> {
  const location = await extractCodeLocation(instance.file, instance.line, contextLines)

  // Merge context from pattern instance if available
  if (instance.context) {
    location.context = {
      before: instance.context.before
        ? [instance.context.before, ...(location.context?.before || [])]
        : location.context?.before,
      after: instance.context.after
        ? [...(location.context?.after || []), instance.context.after]
        : location.context?.after,
    }
  }

  return location
}

/**
 * Format code location as markdown code block
 */
export function formatCodeLocation(location: CodeLocation): string {
  const relativePath = location.file.replace(process.cwd(), '').replace(/^\//, '')
  const lineRef = `${location.line}:${location.line}:${relativePath}`

  let codeBlock = `\`\`\`${lineRef}\n${location.code}\n\`\`\``

  if (location.context?.before && location.context.before.length > 0) {
    codeBlock = `\`\`\`${lineRef}\n// ...\n${location.context.before
      .slice(-2)
      .join('\n')}\n${location.code}\n\`\`\``
  }

  if (location.context?.after && location.context.after.length > 0) {
    codeBlock = `\`\`\`${lineRef}\n${location.code}\n${location.context.after
      .slice(0, 2)
      .join('\n')}\n// ...\n\`\`\``
  }

  return codeBlock
}
