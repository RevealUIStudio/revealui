/**
 * Orchestration utilities for Rev loop iterative workflow
 * Manages workflow state, validation, and lifecycle operations
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ErrorCode, ScriptError } from '../lib/errors.js'
import type { RevState, RevStateFile } from '../types.js'

/**
 * Get the path to the workflow state file
 */
export function getStateFilePath(projectRoot: string): string {
  return join(projectRoot, '.cursor', 'rev-state.md')
}

/**
 * Get the path to the workflow prompt file
 */
export function getPromptFilePath(projectRoot: string): string {
  return join(projectRoot, '.cursor', 'rev-prompt.md')
}

/**
 * Get the path to the completion marker file
 */
export function getCompletionMarkerPath(projectRoot: string): string {
  return join(projectRoot, '.cursor', 'rev-complete.marker')
}

/**
 * Check if a workflow is currently active
 */
export async function isWorkflowActive(projectRoot: string): Promise<boolean> {
  const stateFilePath = getStateFilePath(projectRoot)
  return existsSync(stateFilePath)
}

/**
 * Read the workflow state file
 */
export async function readStateFile(projectRoot: string): Promise<RevStateFile> {
  const stateFilePath = getStateFilePath(projectRoot)

  if (!existsSync(stateFilePath)) {
    throw new ScriptError('No active workflow state file found', ErrorCode.NOT_FOUND)
  }

  const content = await readFile(stateFilePath, 'utf-8')

  // Parse frontmatter (YAML between --- delimiters)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatterMatch) {
    throw new ScriptError(
      'Invalid state file format: missing frontmatter',
      ErrorCode.VALIDATION_ERROR,
    )
  }

  const frontmatterText = frontmatterMatch[1]
  const prompt = frontmatterMatch[2].trim()

  // Parse YAML frontmatter (simple key-value parser)
  const frontmatter: Partial<RevState> = {}
  const lines = frontmatterText.split('\n')

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      const [, key, value] = match
      // Parse value based on type
      if (value === 'true' || value === 'false') {
        frontmatter[key as keyof RevState] = value === ('true' as never)
      } else if (value === 'null') {
        frontmatter[key as keyof RevState] = null as never
      } else if (/^\d+$/.test(value)) {
        frontmatter[key as keyof RevState] = Number.parseInt(value, 10) as never
      } else if (value.startsWith('"') && value.endsWith('"')) {
        frontmatter[key as keyof RevState] = value.slice(1, -1) as never
      } else {
        frontmatter[key as keyof RevState] = value as never
      }
    }
  }

  // Validate required fields
  if (
    frontmatter.active === undefined ||
    frontmatter.iteration === undefined ||
    frontmatter.max_iterations === undefined ||
    frontmatter.started_at === undefined
  ) {
    throw new ScriptError('Invalid state file: missing required fields', ErrorCode.VALIDATION_ERROR)
  }

  return {
    frontmatter: frontmatter as RevState,
    prompt,
  }
}

/**
 * Write the workflow state file
 */
export async function writeStateFile(
  projectRoot: string,
  state: RevState,
  prompt: string,
): Promise<void> {
  const stateFilePath = getStateFilePath(projectRoot)

  // Ensure .cursor directory exists
  const cursorDir = join(projectRoot, '.cursor')
  await mkdir(cursorDir, { recursive: true })

  // Format frontmatter
  const frontmatter = `---
active: ${state.active}
iteration: ${state.iteration}
max_iterations: ${state.max_iterations}
completion_promise: ${state.completion_promise !== null ? `"${state.completion_promise}"` : 'null'}
started_at: ${state.started_at}
prompt_file: ${state.prompt_file}
completion_marker: ${state.completion_marker}
---

${prompt}
`

  await writeFile(stateFilePath, frontmatter, 'utf-8')
}

/**
 * Validate the workflow state file
 */
export async function validateStateFile(
  projectRoot: string,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  try {
    const stateFile = await readStateFile(projectRoot)
    const state = stateFile.frontmatter

    // Validate state fields
    if (typeof state.active !== 'boolean') {
      errors.push('Invalid "active" field: must be boolean')
    }

    if (typeof state.iteration !== 'number' || state.iteration < 1) {
      errors.push('Invalid "iteration" field: must be positive number')
    }

    if (typeof state.max_iterations !== 'number' || state.max_iterations < 0) {
      errors.push('Invalid "max_iterations" field: must be non-negative number')
    }

    if (
      state.completion_promise !== null &&
      (typeof state.completion_promise !== 'string' || !state.completion_promise.trim())
    ) {
      errors.push('Invalid "completion_promise" field: must be string or null')
    }

    if (typeof state.started_at !== 'string' || !state.started_at.trim()) {
      errors.push('Invalid "started_at" field: must be non-empty string')
    }

    if (typeof state.prompt_file !== 'string' || !state.prompt_file.trim()) {
      errors.push('Invalid "prompt_file" field: must be non-empty string')
    }

    if (typeof state.completion_marker !== 'string' || !state.completion_marker.trim()) {
      errors.push('Invalid "completion_marker" field: must be non-empty string')
    }

    // Validate prompt content
    if (!stateFile.prompt?.trim()) {
      errors.push('Invalid prompt: must be non-empty')
    }

    // Validate max iterations
    if (state.max_iterations > 0 && state.iteration > state.max_iterations) {
      errors.push(
        `Invalid iteration count: ${state.iteration} exceeds max_iterations ${state.max_iterations}`,
      )
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

/**
 * Read the completion marker file
 */
export async function readCompletionMarker(projectRoot: string): Promise<string | null> {
  const markerPath = getCompletionMarkerPath(projectRoot)

  if (!existsSync(markerPath)) {
    return null
  }

  try {
    const content = await readFile(markerPath, 'utf-8')
    return content.trim()
  } catch {
    return null
  }
}

/**
 * Check if the workflow is complete based on the completion promise
 */
export async function checkCompletion(
  projectRoot: string,
  completionPromise: string,
): Promise<boolean> {
  const markerContent = await readCompletionMarker(projectRoot)

  if (!markerContent) {
    return false
  }

  // Check if marker matches the completion promise
  return markerContent === completionPromise
}

/**
 * Clean up workflow state and files
 */
export async function cleanupWorkflow(projectRoot: string): Promise<void> {
  const stateFilePath = getStateFilePath(projectRoot)
  const promptFilePath = getPromptFilePath(projectRoot)
  const markerPath = getCompletionMarkerPath(projectRoot)

  // Remove state file
  if (existsSync(stateFilePath)) {
    await rm(stateFilePath)
  }

  // Remove prompt file
  if (existsSync(promptFilePath)) {
    await rm(promptFilePath)
  }

  // Remove completion marker
  if (existsSync(markerPath)) {
    await rm(markerPath)
  }
}
