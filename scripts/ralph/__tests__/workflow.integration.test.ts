/**
 * Integration tests for Ralph workflow
 */

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkCompletion,
  cleanupWorkflow,
  getCompletionMarkerPath,
  isWorkflowActive,
  readStateFile,
  writeStateFile,
} from '../utils.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const testProjectRoot = join(__dirname, '../../..', '.test-ralph-integration')

describe('Ralph Workflow Integration', () => {
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

  describe('End-to-End Workflow', () => {
    it('should complete full workflow with completion marker', async () => {
      // Start workflow
      const initialState = {
        active: true,
        iteration: 1,
        max_iterations: 10,
        completion_promise: 'DONE',
        started_at: new Date().toISOString(),
        prompt_file: '.cursor/ralph-prompt.md',
        completion_marker: '.cursor/ralph-complete.marker',
      }
      await writeStateFile(testProjectRoot, initialState, 'Test task')

      expect(await isWorkflowActive(testProjectRoot)).toBe(true)

      // Check completion (not complete yet)
      expect(await checkCompletion(testProjectRoot, 'DONE')).toBe(false)

      // Create completion marker
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'DONE')

      // Check completion (now complete)
      expect(await checkCompletion(testProjectRoot, 'DONE')).toBe(true)

      // Read state
      const state = await readStateFile(testProjectRoot)
      expect(state.frontmatter.iteration).toBe(1)
      expect(state.frontmatter.completion_promise).toBe('DONE')

      // Cleanup
      await cleanupWorkflow(testProjectRoot)
      expect(await isWorkflowActive(testProjectRoot)).toBe(false)
    })

    it('should handle workflow without completion promise', async () => {
      const initialState = {
        active: true,
        iteration: 1,
        max_iterations: 0,
        completion_promise: null,
        started_at: new Date().toISOString(),
        prompt_file: '.cursor/ralph-prompt.md',
        completion_marker: '.cursor/ralph-complete.marker',
      }
      await writeStateFile(testProjectRoot, initialState, 'Test task')

      // Check completion (should be false, no promise set)
      expect(await checkCompletion(testProjectRoot, null)).toBe(false)

      // Create marker anyway
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'DONE')

      // Still false (no promise to match)
      expect(await checkCompletion(testProjectRoot, null)).toBe(false)

      await cleanupWorkflow(testProjectRoot)
    })

    it('should handle max iterations reached', async () => {
      const state = {
        active: true,
        iteration: 10,
        max_iterations: 10,
        completion_promise: 'DONE',
        started_at: new Date().toISOString(),
        prompt_file: '.cursor/ralph-prompt.md',
        completion_marker: '.cursor/ralph-complete.marker',
      }
      await writeStateFile(testProjectRoot, state, 'Test task')

      // State is at max iterations
      const readState = await readStateFile(testProjectRoot)
      expect(readState.frontmatter.iteration).toBe(10)
      expect(readState.frontmatter.max_iterations).toBe(10)

      // Cleanup
      await cleanupWorkflow(testProjectRoot)
    })

    it('should persist state across operations', async () => {
      // Write initial state
      const initialState = {
        active: true,
        iteration: 1,
        max_iterations: 5,
        completion_promise: 'DONE',
        started_at: new Date().toISOString(),
        prompt_file: '.cursor/ralph-prompt.md',
        completion_marker: '.cursor/ralph-complete.marker',
      }
      await writeStateFile(testProjectRoot, initialState, 'Test task')

      // Read and verify
      let state = await readStateFile(testProjectRoot)
      expect(state.frontmatter.iteration).toBe(1)
      expect(state.prompt).toBe('Test task')

      // Update state (simulate iteration)
      const updatedState = {
        ...state.frontmatter,
        iteration: 2,
      }
      await writeStateFile(testProjectRoot, updatedState, state.prompt)

      // Read and verify update
      state = await readStateFile(testProjectRoot)
      expect(state.frontmatter.iteration).toBe(2)
      expect(state.prompt).toBe('Test task')

      await cleanupWorkflow(testProjectRoot)
    })

    it('should handle marker file mismatch', async () => {
      const state = {
        active: true,
        iteration: 1,
        max_iterations: 10,
        completion_promise: 'DONE',
        started_at: new Date().toISOString(),
        prompt_file: '.cursor/ralph-prompt.md',
        completion_marker: '.cursor/ralph-complete.marker',
      }
      await writeStateFile(testProjectRoot, state, 'Test task')

      // Create marker with wrong content
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'NOT_DONE')

      // Check completion (should be false, doesn't match)
      expect(await checkCompletion(testProjectRoot, 'DONE')).toBe(false)

      // Update marker to match
      await writeFile(markerPath, 'DONE')
      expect(await checkCompletion(testProjectRoot, 'DONE')).toBe(true)

      await cleanupWorkflow(testProjectRoot)
    })

    it('should handle cleanup of all files', async () => {
      const state = {
        active: true,
        iteration: 1,
        max_iterations: 10,
        completion_promise: 'DONE',
        started_at: new Date().toISOString(),
        prompt_file: '.cursor/ralph-prompt.md',
        completion_marker: '.cursor/ralph-complete.marker',
      }
      await writeStateFile(testProjectRoot, state, 'Test task')

      // Create marker file
      const markerPath = getCompletionMarkerPath(testProjectRoot)
      await writeFile(markerPath, 'DONE')

      // Verify files exist
      expect(await isWorkflowActive(testProjectRoot)).toBe(true)

      // Cleanup
      await cleanupWorkflow(testProjectRoot)

      // Verify files are gone
      expect(await isWorkflowActive(testProjectRoot)).toBe(false)
      const { fileExists } = await import('../../shared/utils.js')
      expect(await fileExists(markerPath)).toBe(false)
    })
  })
})
