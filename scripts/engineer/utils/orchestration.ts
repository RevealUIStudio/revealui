/**
 * Utilities for Ralph-inspired iterative workflow
 * Handles state file parsing, writing, and validation
 */

import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import type {RalphState,RalphStateFile} from '../types.ts'

const STATE_FILE_PATH = '.cursor/ralph-loop.local.md'
const PROMPT_FILE_PATH = '.cursor/ralph-prompt.md'
const COMPLETION_MARKER_PATH = '.cursor/ralph-complete.marker'

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath)
    return true
  } catch {
    return false
  }
}
/**
 * Get state file path (absolute from project root)
 */
export function getStateFilePath(projectRoot: string): string {
  return join(projectRoot, STATE_FILE_PATH)
}

/**
 * Get prompt file path (absolute from project root)
 */
export function getPromptFilePath(projectRoot: string): string {
  return join(projectRoot, PROMPT_FILE_PATH)
}

/**
 * Get completion marker path (absolute from project root)
 */
export function getCompletionMarkerPath(projectRoot: string): string {
  return join(projectRoot, COMPLETION_MARKER_PATH)
}

/**
 * Parse YAML frontmatter (simple parser for our use case)
 */
function parseYamlFrontmatter(yamlText: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yamlText.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    let value: string | number | boolean | null = trimmed.slice(colonIndex + 1).trim()

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Parse boolean
    if (value === 'true') {
      result[key] = true
    } else if (value === 'false') {
      result[key] = false
    } else if (value === 'null') {
      result[key] = null
    } else if (/^\d+$/.test(value)) {
      // Parse integer
      result[key] = Number.parseInt(value, 10)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Serialize value to YAML (simple serializer)
 */
function serializeYamlValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') {
    // Quote if contains special characters
    if (value.includes(':') || value.includes("'") || value.includes('"') || value.includes(' ')) {
      return `"${value.replace(/"/g, '\\"')}"`
    }
    return value
  }
  return String(value)
}

/**
 * Read state file and parse it
 */
export async function readStateFile(projectRoot: string): Promise<RalphStateFile> {
  const stateFilePath = getStateFilePath(projectRoot)

  if (!(await fileExists(stateFilePath))) {
    throw new Error(
      `State file not found: ${stateFilePath}\nRun 'pnpm ralph:start' to begin a workflow.`,
    )
  }

  const content = await readFile(stateFilePath)
  // const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
const frontmatterMatch = content.buffer
  if (!frontmatterMatch) {
    throw new Error(`Invalid state file format: ${stateFilePath}\nMissing YAML frontmatter.`)
  }

  const frontmatterYaml = frontmatterMatch[1]
  const prompt = frontmatterMatch[2].trim()

  const frontmatter = parseYamlFrontmatter(frontmatterYaml)

  // Validate required fields
  const requiredFields = [
    'active',
    'iteration',
    'max_iterations',
    'completion_promise',
    'started_at',
  ]
  for (const field of requiredFields) {
    if (!(field in frontmatter)) {
      throw new Error(
        `Invalid state file: missing required field '${field}'\nFile may be corrupted. Run 'pnpm ralph:cancel' to reset.`,
      )
    }
  }

  const state: RalphState = {
    active: frontmatter.active as boolean,
    iteration: frontmatter.iteration as number,
    // biome-ignore lint/style/useNamingConvention: matches state file schema
    max_iterations: frontmatter.max_iterations as number,
    // biome-ignore lint/style/useNamingConvention: matches state file schema
    completion_promise: frontmatter.completion_promise as string | null,
    // biome-ignore lint/style/useNamingConvention: matches state file schema
    started_at: frontmatter.started_at as string,
    // biome-ignore lint/style/useNamingConvention: matches state file schema
    prompt_file: (frontmatter.prompt_file as string) || PROMPT_FILE_PATH,
    // biome-ignore lint/style/useNamingConvention: matches state file schema
    completion_marker: (frontmatter.completion_marker as string) || COMPLETION_MARKER_PATH,
  }

  return { frontmatter: state, prompt }
}

/**
 * Write state file
 */
export async function writeStateFile(
  projectRoot: string,
  state: RalphState,
  prompt: string,
): Promise<void> {
  const stateFilePath = getStateFilePath(projectRoot)

  // Build YAML frontmatter
  const frontmatterLines = [
    '---',
    `active: ${serializeYamlValue(state.active)}`,
    `iteration: ${serializeYamlValue(state.iteration)}`,
    `max_iterations: ${serializeYamlValue(state.max_iterations)}`,
    `completion_promise: ${serializeYamlValue(state.completion_promise)}`,
    `started_at: ${serializeYamlValue(state.started_at)}`,
    `prompt_file: ${serializeYamlValue(state.prompt_file)}`,
    `completion_marker: ${serializeYamlValue(state.completion_marker)}`,
    '---',
    '',
  ]

  const content = frontmatterLines.join('\n') + prompt

  await writeFile(stateFilePath, content)
}

/**
 * Check if state file exists (workflow is active)
 */
export async function isWorkflowActive(projectRoot: string): Promise<boolean> {
  const stateFilePath = getStateFilePath(projectRoot)
  return await fileExists(stateFilePath)
}

/**
 * Read completion marker file
 */
export async function readCompletionMarker(projectRoot: string): Promise<string | null> {
  const markerPath = getCompletionMarkerPath(projectRoot)

  if (!(await fileExists(markerPath))) {
    return null
  }

  const content = await readFile(markerPath)
  return content.join()
}

/**
 * Check if completion marker matches promise
 */
export async function checkCompletion(
  projectRoot: string,
  completionPromise: string | null,
): Promise<boolean> {
  if (!completionPromise) {
    return false
  }

  const markerContent = await readCompletionMarker(projectRoot)
  if (!markerContent) {
    return false
  }

  return markerContent === completionPromise
}

/**
 * Delete state file and related files
 */
export async function cleanupWorkflow(projectRoot: string): Promise<void> {
  const { unlink } = await import('node:fs/promises')

  const files = [
    getStateFilePath(projectRoot),
    getPromptFilePath(projectRoot),
    getCompletionMarkerPath(projectRoot),
  ]

  for (const file of files) {
    if (await fileExists(file)) {
      try {
        await unlink(file)
      } catch (_error) {
        // Ignore errors if file doesn't exist
      }
    }
  }
}

/**
 * Validate state file integrity
 */
export async function validateStateFile(projectRoot: string): Promise<{
  valid: boolean
  errors: string[]
}> {
  const errors: string[] = []

  try {
    const stateFile = await readStateFile(projectRoot)

    // Validate iteration
    if (stateFile.frontmatter.iteration < 1) {
      errors.push('iteration must be >= 1')
    }

    // Validate max_iterations
    if (stateFile.frontmatter.max_iterations < 0) {
      errors.push('max_iterations must be >= 0 (0 = unlimited)')
    }

    // Validate iteration <= max_iterations (if max_iterations > 0)
    if (
      stateFile.frontmatter.max_iterations > 0 &&
      stateFile.frontmatter.iteration > stateFile.frontmatter.max_iterations
    ) {
      errors.push('iteration exceeds max_iterations')
    }

    // Validate prompt is non-empty
    if (!stateFile.prompt.trim()) {
      errors.push('prompt text is empty')
    }

    // Validate started_at is valid ISO date
    try {
      new Date(stateFile.frontmatter.started_at)
    } catch {
      errors.push('started_at is not a valid ISO date string')
    }
  } catch (error) {
    errors.push(
      `Failed to read state file: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
