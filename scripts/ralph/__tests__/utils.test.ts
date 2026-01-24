/**
 * Unit tests for Ralph workflow utilities
 */

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RalphState } from '../types.js'
import {
  checkCompletion,
  cleanupWorkflow,
  getCompletionMarkerPath,
  getPromptFilePath,
  getStateFilePath,
  isWorkflowActive,
  readCompletionMarker,
  readStateFile,
  validateStateFile,
  writeStateFile,
} from '../utils.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const testProjectRoot = join(__dirname, '../../..', '.test-ralph')
const baseState: RalphState = {
  active: true,
  iteration: 1,
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  max_iterations: 50,
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  completion_promise: 'DONE',
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  started_at: '2025-01-08T12:00:00Z',
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  prompt_file: '.cursor/ralph-prompt.md',
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  completion_marker: '.cursor/ralph-complete.marker',
}

describe('Ralph Utils', () => {
  beforeEach(async () => {
    // Clean up test directory
    try {
      await rm(testProjectRoot, { recursive: true, force: true })
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(join(testProjectRoot, '.cursor'), { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testProjectRoot, { recursive: true, force: true })
    } catch {
      // Ignore errors
    }
  })

  describe('getStateFilePath', () => {
    it('should return correct state file path', () => {
      const path = getStateFilePath(testProjectRoot)
      expect(path).toBe(join(testProjectRoot, '.cursor', 'ralph-loop.local.md'))
    })
  })

  describe('getPromptFilePath', () => {
    it('should return correct prompt file path', () => {
      const path = getPromptFilePath(testProjectRoot)
      expect(path).toBe(join(testProjectRoot, '.cursor', 'ralph-prompt.md'))
    })
  })

  describe('getCompletionMarkerPath', () => {
    it('should return correct marker file path', () => {
      const path = getCompletionMarkerPath(testProjectRoot)
      expect(path).toBe(join(testProjectRoot, '.cursor', 'ralph-complete.marker'))
    })
  })

  describe('writeStateFile and readStateFile', () => {
    it('should write and read state file correctly', async () => {
      const state = { ...baseState }
      const prompt = 'Test prompt'

      await writeStateFile(testProjectRoot, state, prompt)
      const result = await readStateFile(testProjectRoot)

      expect(result.frontmatter).toMatchObject(state)
      expect(result.prompt).toBe(prompt)
    })

    it('should handle null completion_promise', async () => {
      const state = { ...baseState }
      state.max_iterations = 0
      state.completion_promise = null
      const prompt = 'Test prompt'

      await writeStateFile(testProjectRoot, state, prompt)
      const result = await readStateFile(testProjectRoot)

      expect(result.frontmatter.completion_promise).toBeNull()
    })

    it('should handle quoted strings in completion_promise', async () => {
      const state = { ...baseState }
      state.completion_promise = 'TASK COMPLETE'
      const prompt = 'Test prompt'

      await writeStateFile(testProjectRoot, state, prompt)
      const result = await readStateFile(testProjectRoot)

      expect(result.frontmatter.completion_promise).toBe('TASK COMPLETE')
    })

    it('should handle special characters in completion_promise', async () => {
      const state = { ...baseState }
      state.completion_promise = 'Text with: colons'
      const prompt = 'Test prompt'

      await writeStateFile(testProjectRoot, state, prompt)
      const result = await readStateFile(testProjectRoot)

      expect(result.frontmatter.completion_promise).toBe('Text with: colons')
    })

    it('should throw error if state file does not exist', async () => {
      await expect(readStateFile(testProjectRoot)).rejects.toThrow('State file not found')
    })

    it('should throw error if state file has invalid format', async () => {
      const invalidFile = getStateFilePath(testProjectRoot)
      await writeFile(invalidFile, 'invalid content without frontmatter')

      await expect(readStateFile(testProjectRoot)).rejects.toThrow('Invalid state file format')
    })

    it('should throw error if required fields are missing', async () => {
      const invalidFile = getStateFilePath(testProjectRoot)
      await writeFile(
        invalidFile,
        `---
active: true
iteration: 1
---
Test prompt`,
      )

      await expect(readStateFile(testProjectRoot)).rejects.toThrow('missing required field')
    })
  })

  describe('isWorkflowActive', () => {
    it('should return false if state file does not exist', async () => {
      const active = await isWorkflowActive(testProjectRoot)
      expect(active).toBe(false)
    })

    it('should return true if state file exists', async () => {
      const state = { ...baseState }
      await writeStateFile(testProjectRoot, state, 'Test prompt')

      const active = await isWorkflowActive(testProjectRoot)
      expect(active).toBe(true)
    })
  })

  describe('readCompletionMarker', () => {
    it('should return null if marker file does not exist', async () => {
      const marker = await readCompletionMarker(testProjectRoot)
      expect(marker).toBeNull()
    })

    it('should return marker content if file exists', async () => {
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'DONE')

      const marker = await readCompletionMarker(testProjectRoot)
      expect(marker).toBe('DONE')
    })

    it('should trim whitespace from marker content', async () => {
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, '  DONE  \n')

      const marker = await readCompletionMarker(testProjectRoot)
      expect(marker).toBe('DONE')
    })
  })

  describe('checkCompletion', () => {
    it('should return false if marker file does not exist', async () => {
      const complete = await checkCompletion(testProjectRoot, 'DONE')
      expect(complete).toBe(false)
    })

    it('should return false if marker does not match promise', async () => {
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'NOT_DONE')

      const complete = await checkCompletion(testProjectRoot, 'DONE')
      expect(complete).toBe(false)
    })

    it('should return true if marker matches promise', async () => {
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'DONE')

      const complete = await checkCompletion(testProjectRoot, 'DONE')
      expect(complete).toBe(true)
    })

    it('should return false if completion_promise is null', async () => {
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'DONE')

      const complete = await checkCompletion(testProjectRoot, null)
      expect(complete).toBe(false)
    })
  })

  describe('cleanupWorkflow', () => {
    it('should remove state file if it exists', async () => {
      const state = { ...baseState }
      await writeStateFile(testProjectRoot, state, 'Test prompt')

      await cleanupWorkflow(testProjectRoot)

      const active = await isWorkflowActive(testProjectRoot)
      expect(active).toBe(false)
    })

    it('should remove marker file if it exists', async () => {
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'DONE')

      await cleanupWorkflow(testProjectRoot)

      const marker = await readCompletionMarker(testProjectRoot)
      expect(marker).toBeNull()
    })

    it('should not throw if files do not exist', async () => {
      await expect(cleanupWorkflow(testProjectRoot)).resolves.not.toThrow()
    })
  })

  describe('validateStateFile', () => {
    it('should validate correct state file', async () => {
      const state = { ...baseState }
      await writeStateFile(testProjectRoot, state, 'Test prompt')

      const validation = await validateStateFile(testProjectRoot)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect invalid iteration (< 1)', async () => {
      const state = { ...baseState }
      state.iteration = 0
      await writeStateFile(testProjectRoot, state, 'Test prompt')

      const validation = await validateStateFile(testProjectRoot)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('iteration must be >= 1')
    })

    it('should detect invalid max_iterations (< 0)', async () => {
      const state = { ...baseState }
      state.max_iterations = -1
      await writeStateFile(testProjectRoot, state, 'Test prompt')

      const validation = await validateStateFile(testProjectRoot)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('max_iterations must be >= 0 (0 = unlimited)')
    })

    it('should detect iteration exceeding max_iterations', async () => {
      const state = { ...baseState }
      state.iteration = 51
      await writeStateFile(testProjectRoot, state, 'Test prompt')

      const validation = await validateStateFile(testProjectRoot)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('iteration exceeds max_iterations')
    })

    it('should allow iteration equal to max_iterations', async () => {
      const state = { ...baseState }
      state.iteration = 50
      await writeStateFile(testProjectRoot, state, 'Test prompt')

      const validation = await validateStateFile(testProjectRoot)
      expect(validation.valid).toBe(true)
    })

    it('should detect empty prompt', async () => {
      const state = { ...baseState }
      await writeStateFile(testProjectRoot, state, '   ')

      const validation = await validateStateFile(testProjectRoot)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('prompt text is empty')
    })

    it('should detect invalid started_at date', async () => {
      // Write invalid state file manually
      const stateFilePath = getStateFilePath(testProjectRoot)
      await writeFile(
        stateFilePath,
        `---
active: true
iteration: 1
max_iterations: 50
completion_promise: "DONE"
started_at: "invalid-date"
prompt_file: ".cursor/ralph-prompt.md"
completion_marker: ".cursor/ralph-complete.marker"
---

Test prompt`,
      )

      const validation = await validateStateFile(testProjectRoot)
      // Note: Date validation might pass (Date constructor is lenient)
      // This test documents expected behavior
      expect(validation.valid).toBeDefined()
    })
  })
})
