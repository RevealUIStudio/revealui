/**
 * SKILL.md Parser
 *
 * Parses SKILL.md files to extract YAML frontmatter and markdown instructions.
 */

import * as yaml from 'yaml'
import { type SkillMetadata, SkillMetadataSchema } from '../types.js'

/**
 * Result of parsing a SKILL.md file.
 */
export interface ParsedSkillMd {
  metadata: SkillMetadata
  instructions: string
  rawFrontmatter: string
}

/**
 * Parse a SKILL.md file content into metadata and instructions.
 *
 * SKILL.md format:
 * ```
 * ---
 * name: skill-name
 * description: What this skill does
 * ---
 *
 * # Instructions
 *
 * Markdown content here...
 * ```
 *
 * @param content - Raw SKILL.md file content
 * @returns Parsed skill metadata and instructions
 * @throws Error if frontmatter is missing or invalid
 */
export function parseSkillMd(content: string): ParsedSkillMd {
  // Extract frontmatter using --- delimiters
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)

  if (!frontmatterMatch) {
    throw new Error('SKILL.md must contain YAML frontmatter between --- delimiters')
  }

  const rawFrontmatter = frontmatterMatch[1] ?? ''
  const instructions = frontmatterMatch[2] ?? ''

  // Parse YAML
  let parsedYaml: Record<string, unknown>
  try {
    parsedYaml = yaml.parse(rawFrontmatter) as Record<string, unknown>
  } catch (error) {
    throw new Error(
      `Invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  // Normalize allowed-tools field
  if (parsedYaml['allowed-tools'] && !parsedYaml.allowedTools) {
    parsedYaml.allowedTools = parsedYaml['allowed-tools']
    parsedYaml['allowed-tools'] = undefined
  }

  // Parse allowed-tools string format: "Bash(git:*) Read Write"
  if (typeof parsedYaml.allowedTools === 'string') {
    parsedYaml.allowedTools = parseAllowedToolsString(parsedYaml.allowedTools)
  }

  // Validate against schema
  const parseResult = SkillMetadataSchema.safeParse(parsedYaml)

  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid skill metadata:\n${errors.join('\n')}`)
  }

  return {
    metadata: parseResult.data,
    instructions: instructions.trim(),
    rawFrontmatter,
  }
}

/**
 * Parse allowed-tools string format into array.
 *
 * Example: "Bash(git:*) Read Write(*.ts)" -> ["Bash(git:*)", "Read", "Write(*.ts)"]
 */
export function parseAllowedToolsString(spec: string): string[] {
  const tools: string[] = []
  let current = ''
  let parenDepth = 0

  for (const char of spec) {
    if (char === '(') {
      parenDepth++
      current += char
    } else if (char === ')') {
      parenDepth--
      current += char
    } else if (char === ' ' && parenDepth === 0) {
      if (current.trim()) {
        tools.push(current.trim())
      }
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    tools.push(current.trim())
  }

  return tools
}

/**
 * Extract only the metadata from a SKILL.md file (lightweight parsing).
 * Used for loading skill listings without full content.
 *
 * @param content - Raw SKILL.md file content
 * @returns Just the metadata portion
 */
export function parseSkillMetadataOnly(content: string): SkillMetadata {
  const result = parseSkillMd(content)
  return result.metadata
}

/**
 * Validate that a string is valid SKILL.md format.
 *
 * @param content - Content to validate
 * @returns true if valid, error message if invalid
 */
export function validateSkillMd(content: string): true | string {
  try {
    parseSkillMd(content)
    return true
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/**
 * Generate a SKILL.md file from metadata and instructions.
 *
 * @param metadata - Skill metadata
 * @param instructions - Markdown instructions
 * @returns SKILL.md file content
 */
export function generateSkillMd(metadata: SkillMetadata, instructions: string): string {
  const frontmatter = yaml.stringify(metadata, { indent: 2 })
  return `---\n${frontmatter}---\n\n${instructions}`
}
